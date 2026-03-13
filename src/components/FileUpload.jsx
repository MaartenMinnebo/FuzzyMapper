import React, { useRef, useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import './FileUpload.css';

const FileUpload = ({ label, file, onFileLoaded }) => {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) onFileLoaded(droppedFile);
  };

  const handleChange = (e) => {
    const selected = e.target.files[0];
    if (selected) onFileLoaded(selected);
  };

  return (
    <div
      className={`file-upload-zone ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <div className="file-upload-content">
        {file ? (
          <>
            <FileText size={32} className="file-icon loaded" />
            <p className="file-name">{file.name}</p>
            <span className="file-hint">Klik om te vervangen</span>
          </>
        ) : (
          <>
            <Upload size={32} className="file-icon" />
            <p className="file-label">{label}</p>
            <span className="file-hint">Sleep CSV hier of klik om te selecteren</span>
          </>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
