import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
}

export const PageContainer: React.FC<PageContainerProps> = ({ children }) => {
  return (
    <div className="terminal-workspace">
      {children}
    </div>
  );
};
