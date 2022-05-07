import React from "react";
import NavBar from '../../components/NavBar/NavBar';
import Tecs from '../../components/Tecs/Tecs';
import Camera from "../../components/Camera/Camera";
import Header from "../../components/Header/Header";

function Home() {
  
  return (
    <div className='App'>
      <div className='gradient__bg'>
        <NavBar />
        <Header/>
        <Camera />
        <Tecs />
      </div>
    </div>
    
  );
}

export default Home;