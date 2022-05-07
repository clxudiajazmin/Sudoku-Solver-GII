import React from 'react';
import "./App.css";
import {BrowserRouter as Router, Route, Routes} from 'react-router-dom'
import Home from './pages/Home/Home';
import Solver from './pages/Solver/Solver';

function App() {
  return (
    <Router>
      
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/solver" element={<Solver />} />
      </Routes>
    </Router>
    
  );
}
export default App;