import React from 'react';

interface StringListProps {
  items: string[];
}

const StringList: React.FC<StringListProps> = ({ items }) => {
  return (
    <div className="string-list">
      <h2>List of Items</h2>
      <ul>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
};

export default StringList;
