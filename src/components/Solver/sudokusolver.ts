class Data {
    left: Data;
    right: Data;
    up: Data;
    down: Data;
    column: Column | null;
    guess: Guess | null;
    constructor(column: Column = null, guess: Guess = null) {
      this.column = column;
      this.guess = guess;

      this.left = this;
      this.right = this;
      this.up = this;
      this.down = this;
    }
    insertRight(node: Data) {
      node.left = this;
      node.right = this.right;
      this.right.left = node;
      this.right = node;
    }
    insertLeft(node: Data) {
      node.right = this;
      node.left = this.left;
      this.left.right = node;
      this.left = node;
    }
    insertUp(node: Data) {
      node.down = this;
      node.up = this.up;
      this.up.down = node;
      this.up = node;
    }
    insertDown(node: Data) {
      node.up = this;
      node.down = this.down;
      this.down.up = node;
      this.down = node;
    }
  }
  
  class Column extends Data {
    size: number;
    constructor() {
      super();
      this.size = 0;
    }
  }
  
  class Guess {
    x: number;
    y: number;
    entry: number;
    // Valor conocido
    isKnown: boolean = false;
    constructor(x: number, y: number, entry: number) {
      this.x = x;
      this.y = y;
      this.entry = entry;
    }
  }
  
  export default class SudokuSolver {
    columnRoot: Column; 
    columnLookup: Column[] = [];
    rowLookup: Data[] = [];
    solution: Data[] = []; 
  
    // Lista circular
    public constructor() {
      // construct the rows and columns
      // https://en.wikipedia.org/wiki/Exact_cover#Sudoku and https://www.stolaf.edu//people/hansonr/sudoku/exactcovermatrix.htm
      // https://www.kth.se/social/files/58861771f276547fe1dbf8d1/HLaestanderMHarrysson_dkand14.pdf
  
      // Lista doble
      this.columnRoot = new Column();
      for (let col = 0; col < 81 * 4; col++) {
        const column = new Column();
        this.columnRoot.insertRight(column);
        // STASH
        this.columnLookup.push(column);
      }

      for (let x = 0; x < 9; x++) {
        for (let y = 0; y < 9; y++) {
          for (let entry = 0; entry < 9; entry++) {
            const guess = new Guess(x, y, entry + 1);
            //Nodos
            const entryColIdx = y * 9 + x;
            const entryColumn = this.columnLookup[entryColIdx];
            const entryConstraint = new Data(entryColumn, guess);
            this.rowLookup[(y * 9 + x) * 9 + entry] = entryConstraint;
            //Nodo
            entryColumn.insertDown(entryConstraint);
            entryColumn.size++;
  
            // Nodo en fila
            const rowColIdx = 81 + y * 9 + entry;
            const rowColumn = this.columnLookup[rowColIdx];
            const rowConstraint = new Data(rowColumn, guess);

            entryConstraint.insertRight(rowConstraint);

            rowColumn.insertDown(rowConstraint);
            rowColumn.size++;
  
            // Nodo en columna
            const colColIdx = 81 * 2 + x * 9 + entry;
            const colCol = this.columnLookup[colColIdx];
            const columnConstraint = new Data(colCol, guess);

            rowConstraint.insertRight(columnConstraint);

            colCol.insertDown(columnConstraint);
            colCol.size++;
  
            // Nodo para caja
            const boxX = Math.floor(x / 3);
            const boxY = Math.floor(y / 3);
            const boxColumnIndex = 81 * 3 + (boxY * 3 + boxX) * 9 + entry;
            const boxColumn = this.columnLookup[boxColumnIndex];
            const boxConstraint = new Data(boxColumn, guess);

            columnConstraint.insertRight(boxConstraint);

            boxColumn.insertDown(boxConstraint);
            boxColumn.size++;
          }
        }
      }
    }
  
    setNumber(x: number, y: number, entry: number) {
      // Encontrar fila
      const row = this.rowLookup[(y * 9 + x) * 9 + entry];
      row.guess.isKnown = true;
      this.solution.push(row);
      this.cover(row.column);
      for (let right = row.right; right !== row; right = right.right) {
        this.cover(right.column);
      }
    }
  
    //Columna con menos filas -> más rápido
    getSmallestColumn() {
      let smallestSize = (this.columnRoot.right as Column).size;
      let smallestColumn = this.columnRoot.right as Column;
      let col = this.columnRoot.right as Column;
      while (col !== this.columnRoot) {
        if (col.size < smallestSize) {
          smallestSize = col.size;
          smallestColumn = col;
        }
        col = col.right as Column;
      }
      return smallestColumn;
    }
  
    search(depth: number = 0): boolean {
      // Evitar mucha profundidad
      if (depth > 100) {
        throw new Error("too deep - giving up");
      }
      // Success
      if (this.columnRoot.right === this.columnRoot) {
        return true;
      }
      // Columna con menos filas
      let column = this.getSmallestColumn();
      this.cover(column);
      for (let row = column.down; row !== column; row = row.down) {
        this.solution.push(row);
        for (let right = row.right; right !== row; right = right.right) {
          this.cover(right.column);
        }
        if (this.search(depth + 1)) {
          return true;
        }
        // Backtrack
        for (let left = row.left; left !== row; left = left.left) {
          this.uncover(left.column);
        }
        this.solution.pop();
      }
      // Fail
      this.uncover(column);
      return false;
    }
  
    // Deslindar la columna de la lisa y cualquier fila de otras columnas
    cover(column: Column) {
      column.right.left = column.left;
      column.left.right = column.right;
      for (let row = column.down; row !== column; row = row.down) {
        for (let right = row.right; right !== row; right = right.right) {
          right.down.up = right.up;
          right.up.down = right.down;
          right.column.size--;
        }
      }
    }
  
    //Agregar las filas devuelta a la columna
    uncover(column: Column) {
      for (let row = column.up; row !== column; row = row.up) {
        for (let left = row.left; left !== row; left = left.left) {
          left.down.up = left;
          left.up.down = left;
          left.column.size++;
        }
      }
      column.right.left = column;
      column.left.right = column;
    }
  }