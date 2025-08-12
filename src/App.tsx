import React from 'react';
import StringList from './components/StringList';
import './App.css';

function App() {
  // Sample list of strings for demonstration
  const sampleStrings = [
    'First item in the list',
    'Second item in the list',
    'Third item in the list',
    'Fourth item in the list',
    'Fifth item in the list'
  ];

  return (
    <div className="App">
      <header className="App-header">
        <h1>Sanding Monitoring Web App</h1>
      </header>
      <main>
        <StringList items={sampleStrings} />
      </main>
    </div>
  );
}

export default App;
