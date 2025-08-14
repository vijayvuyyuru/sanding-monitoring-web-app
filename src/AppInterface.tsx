import React from 'react';
import styles from './AppInterface.module.css';

const AppInterface: React.FC = () => {
  return (
    <div className={styles.appInterface}>
      <header className={styles.appHeader}>
        <h1>Sanding Control Interface</h1>
      </header>
      
      <main className={styles.mainContent}>
        Hello
      </main>
    </div>
  );
};

export default AppInterface;