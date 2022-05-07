import React from 'react';
import './header.css';
import ai from '../../assets/ai.png';
import { Link } from 'react-router-dom';

const Header = () => {
  return (
    <div className="sudoku__header section__padding" id="home">
      <div className="sudoku__header-content">
        <h1 className="gradient__text">Resolver Sudokus en tiempo real con IA</h1>

        <div className="sudoku__header-content__buttom">
          <button type="button"><Link to = "/solver">Resolver</Link></button>
        </div>
      </div>

      <div className="sudoku__header-image">
        <img src={ai} alt="Fondo"/>
      </div>
    </div>
  )
}

export default Header