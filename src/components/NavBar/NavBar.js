import React, {useState} from 'react';
import { RiMenu3Line, RiCloseLine } from 'react-icons/ri';
import { Link } from 'react-router-dom';
import './navbar.css';

const Menu = () => (
    <>
        <p><Link to = "/">Inicio</Link></p>
        <p><Link to = "/solver">Resolver</Link></p>
    </>
)

const NavBar = () => {
    const [toggleMenu, setToggleMenu] = useState(false);
    return (
        <div className="sudoku__navbar">
            <div className="sudoku__navbar-links">
                <div className="sudoku__navbar-links_logo">
                    <h1>Sudoku-Solver</h1>
                </div>
                <div className="sudoku__navbar-links_container">
                    <Menu />
                </div>
            </div>
            <div className="sudoku__navbar-menu">
                {toggleMenu
                    ? <RiCloseLine color='#fff' size={27} onClick={() => setToggleMenu(false)} />
                    : <RiMenu3Line color='#fff' size={27} onClick={() => setToggleMenu(true)} />
                }
                {toggleMenu && (
                    <div className="sudoku__navbar-menu_container scale-up-center">
                        <div className="sudoku__navbar-menu_container-links">
                            <Menu />
                        </div>
                    </div>
                )
                }
            </div>
        </div>
    )
}

export default NavBar