import React from 'react';
import NavBar from '../../components/NavBar/NavBar';
import Tecs from '../../components/Tecs/Tecs';
import Camera from '../../components/Camera/Camera';

function Solver() {
  
  return (
    <div className='App'>
      <div className='gradient__bg'>
        <NavBar />
        <Camera />
        <Tecs />
      </div>
    </div>
  )
}

export default Solver