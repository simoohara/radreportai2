/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmModal } from '../ConfirmModal';

describe('ConfirmModal', () => {
  const defaultProps = {
    title: 'Are you sure?',
    message: 'This action cannot be undone.',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders correctly with title and message', () => {
    render(<ConfirmModal {...defaultProps} />);
    
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
    expect(screen.getByText('Confirmer')).toBeInTheDocument();
    expect(screen.getByText('Annuler')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    render(<ConfirmModal {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Confirmer'));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<ConfirmModal {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Annuler'));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Escape key is pressed', () => {
    render(<ConfirmModal {...defaultProps} />);
    
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('applies danger class when danger prop is true', () => {
    render(<ConfirmModal {...defaultProps} danger={true} confirmText="Delete" />);
    
    const confirmButton = screen.getByText('Delete');
    expect(confirmButton).toHaveClass('btn-danger');
    expect(confirmButton).not.toHaveClass('btn-primary');
  });
});
