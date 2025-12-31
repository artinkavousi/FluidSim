/**
 * @package studio/components
 * EmitterListPanel - List and manage emitters
 */

import React, { useState, useCallback } from 'react';
import { useStudioStore } from '../store';
import type { Emitter, EmitterType } from '../../fluid-2d/emitters/types';
import { getPresetNames, getPreset } from '../../fluid-2d/emitters/presets';

// ============================================
// Types
// ============================================

interface EmitterListPanelProps {
  emitters: Emitter[];
  onAddEmitter: (config: Omit<Emitter, 'id'>) => string;
  onRemoveEmitter: (id: string) => void;
  onSelectEmitter: (id: string, additive?: boolean) => void;
  onUpdateEmitter: (id: string, updates: Partial<Emitter>) => void;
  onDuplicateEmitter: (id: string) => void;
  selectedIds: Set<string>;
}

// ============================================
// Emitter Type Icons
// ============================================

const emitterIcons: Record<EmitterType, string> = {
  point: '◉',
  line: '━',
  circle: '◯',
  curve: '〰',
  text: 'T',
  svg: '◇',
  brush: '✎',
};

const emitterColors: Record<EmitterType, string> = {
  point: '#00d4aa',
  line: '#64b5f6',
  circle: '#7c4dff',
  curve: '#ff6b9d',
  text: '#ffc107',
  svg: '#ff5722',
  brush: '#4caf50',
};

// ============================================
// EmitterItem Component
// ============================================

interface EmitterItemProps {
  emitter: Emitter;
  selected: boolean;
  onSelect: (additive?: boolean) => void;
  onUpdate: (updates: Partial<Emitter>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

const EmitterItem: React.FC<EmitterItemProps> = ({
  emitter,
  selected,
  onSelect,
  onUpdate,
  onRemove,
  onDuplicate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(emitter.name);
  
  const handleNameSubmit = () => {
    if (editName.trim() !== emitter.name) {
      onUpdate({ name: editName.trim() });
    }
    setIsEditing(false);
  };
  
  return (
    <div
      className={`emitter-item ${selected ? 'selected' : ''} ${!emitter.active ? 'inactive' : ''}`}
      onClick={(e) => onSelect(e.shiftKey)}
    >
      <div
        className="emitter-icon"
        style={{ color: emitterColors[emitter.type] }}
      >
        {emitterIcons[emitter.type]}
      </div>
      
      <div className="emitter-info">
        {isEditing ? (
          <input
            type="text"
            className="emitter-name-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSubmit();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="emitter-name"
            onDoubleClick={() => setIsEditing(true)}
          >
            {emitter.name}
          </span>
        )}
        <span className="emitter-type">{emitter.type}</span>
      </div>
      
      <div className="emitter-actions">
        <button
          className="action-btn"
          onClick={(e) => {
            e.stopPropagation();
            onUpdate({ visible: !emitter.visible });
          }}
          title={emitter.visible ? 'Hide' : 'Show'}
        >
          {emitter.visible ? '👁' : '👁‍🗨'}
        </button>
        <button
          className="action-btn"
          onClick={(e) => {
            e.stopPropagation();
            onUpdate({ active: !emitter.active });
          }}
          title={emitter.active ? 'Disable' : 'Enable'}
        >
          {emitter.active ? '●' : '○'}
        </button>
        <button
          className="action-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          title="Duplicate"
        >
          ⧉
        </button>
        <button
          className="action-btn delete"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Delete"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

// ============================================
// Add Emitter Modal
// ============================================

interface AddEmitterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (config: Omit<Emitter, 'id'>) => void;
}

const AddEmitterModal: React.FC<AddEmitterModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const [selectedType, setSelectedType] = useState<EmitterType>('point');
  const presets = getPresetNames(selectedType);
  
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Emitter</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body">
          <div className="type-selector">
            {(Object.keys(emitterIcons) as EmitterType[]).map((type) => (
              <button
                key={type}
                className={`type-btn ${selectedType === type ? 'selected' : ''}`}
                onClick={() => setSelectedType(type)}
                style={{
                  borderColor: selectedType === type ? emitterColors[type] : undefined,
                  color: selectedType === type ? emitterColors[type] : undefined,
                }}
              >
                <span className="type-icon">{emitterIcons[type]}</span>
                <span className="type-name">{type}</span>
              </button>
            ))}
          </div>
          
          <div className="preset-list">
            <h4>Presets</h4>
            {presets.map((presetName) => (
              <button
                key={presetName}
                className="preset-btn"
                onClick={() => {
                  const preset = getPreset(selectedType, presetName);
                  if (preset) {
                    onAdd(preset);
                    onClose();
                  }
                }}
              >
                {presetName}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }
        
        .modal-content {
          background: rgba(18, 24, 32, 0.98);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          width: 480px;
          max-height: 80vh;
          overflow: hidden;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
        }
        
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        
        .modal-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
        }
        
        .close-btn {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          font-size: 16px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          transition: all 0.2s ease;
        }
        
        .close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.9);
        }
        
        .modal-body {
          padding: 20px;
          overflow-y: auto;
          max-height: calc(80vh - 60px);
        }
        
        .type-selector {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 20px;
        }
        
        .type-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 12px 8px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .type-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
        }
        
        .type-btn.selected {
          background: rgba(0, 212, 170, 0.1);
        }
        
        .type-icon {
          font-size: 20px;
        }
        
        .type-name {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .preset-list h4 {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(255, 255, 255, 0.5);
          margin: 0 0 12px;
        }
        
        .preset-btn {
          display: block;
          width: 100%;
          padding: 10px 14px;
          margin-bottom: 6px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.75);
          font-size: 12px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .preset-btn:hover {
          background: rgba(0, 212, 170, 0.12);
          border-color: rgba(0, 212, 170, 0.3);
          color: rgba(255, 255, 255, 0.95);
        }
      `}</style>
    </div>
  );
};

// ============================================
// Main Component
// ============================================

export const EmitterListPanel: React.FC<EmitterListPanelProps> = ({
  emitters,
  onAddEmitter,
  onRemoveEmitter,
  onSelectEmitter,
  onUpdateEmitter,
  onDuplicateEmitter,
  selectedIds,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  
  return (
    <div className="emitter-list-panel">
      <div className="panel-header">
        <h3>Emitters</h3>
        <button
          className="add-btn"
          onClick={() => setShowAddModal(true)}
        >
          + Add
        </button>
      </div>
      
      <div className="emitter-list">
        {emitters.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">◉</span>
            <p>No emitters yet</p>
            <button
              className="add-first-btn"
              onClick={() => setShowAddModal(true)}
            >
              Add your first emitter
            </button>
          </div>
        ) : (
          emitters.map((emitter) => (
            <EmitterItem
              key={emitter.id}
              emitter={emitter}
              selected={selectedIds.has(emitter.id)}
              onSelect={(additive) => onSelectEmitter(emitter.id, additive)}
              onUpdate={(updates) => onUpdateEmitter(emitter.id, updates)}
              onRemove={() => onRemoveEmitter(emitter.id)}
              onDuplicate={() => onDuplicateEmitter(emitter.id)}
            />
          ))
        )}
      </div>
      
      <AddEmitterModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={onAddEmitter}
      />
      
      <style>{`
        .emitter-list-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: rgba(12, 18, 26, 0.95);
          border-right: 1px solid rgba(255, 255, 255, 0.08);
        }
        
        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        
        .panel-header h3 {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
        }
        
        .add-btn {
          padding: 6px 12px;
          background: rgba(0, 212, 170, 0.15);
          border: 1px solid rgba(0, 212, 170, 0.3);
          border-radius: 6px;
          color: rgba(0, 212, 170, 0.95);
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .add-btn:hover {
          background: rgba(0, 212, 170, 0.25);
        }
        
        .emitter-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }
        
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
        }
        
        .empty-icon {
          font-size: 32px;
          color: rgba(255, 255, 255, 0.2);
          margin-bottom: 12px;
        }
        
        .empty-state p {
          color: rgba(255, 255, 255, 0.4);
          margin: 0 0 16px;
          font-size: 12px;
        }
        
        .add-first-btn {
          padding: 8px 16px;
          background: rgba(0, 212, 170, 0.12);
          border: 1px solid rgba(0, 212, 170, 0.25);
          border-radius: 6px;
          color: rgba(0, 212, 170, 0.9);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .add-first-btn:hover {
          background: rgba(0, 212, 170, 0.2);
        }
        
        .emitter-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid transparent;
          border-radius: 8px;
          margin-bottom: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        
        .emitter-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        
        .emitter-item.selected {
          background: rgba(0, 212, 170, 0.1);
          border-color: rgba(0, 212, 170, 0.3);
        }
        
        .emitter-item.inactive {
          opacity: 0.5;
        }
        
        .emitter-icon {
          font-size: 16px;
          width: 24px;
          text-align: center;
        }
        
        .emitter-info {
          flex: 1;
          min-width: 0;
        }
        
        .emitter-name {
          display: block;
          color: rgba(255, 255, 255, 0.9);
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .emitter-name-input {
          width: 100%;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(0, 212, 170, 0.5);
          border-radius: 4px;
          padding: 2px 6px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 12px;
          outline: none;
        }
        
        .emitter-type {
          display: block;
          color: rgba(255, 255, 255, 0.4);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .emitter-actions {
          display: flex;
          gap: 4px;
          opacity: 0;
          transition: opacity 0.15s ease;
        }
        
        .emitter-item:hover .emitter-actions {
          opacity: 1;
        }
        
        .action-btn {
          width: 24px;
          height: 24px;
          background: rgba(255, 255, 255, 0.05);
          border: none;
          border-radius: 4px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 11px;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .action-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.9);
        }
        
        .action-btn.delete:hover {
          background: rgba(255, 100, 100, 0.2);
          color: rgba(255, 100, 100, 0.9);
        }
      `}</style>
    </div>
  );
};

export default EmitterListPanel;


