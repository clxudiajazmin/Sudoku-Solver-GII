import React from 'react';
import {  SiReact, SiTensorflow,  SiPython, SiCss3, SiJavascript } from "react-icons/si";
import './tecs.css';

const style = { color: "white", fontSize: "35px" }


const Tecs = () => (
    <div className="sudoku__brand section__padding">
        <div>
            <SiReact style={style}/>
        </div>
        <div>
            <SiTensorflow style={style} />
        </div>
        <div>
            <SiPython style={style} />
        </div>
        <div>
            <SiCss3 style={style} />
        </div>
        <div>
            <SiJavascript style={style} />
        </div>
    </div>
  );

  

export default Tecs