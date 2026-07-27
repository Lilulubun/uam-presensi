import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExpectedTeacherSelector } from '../ExpectedTeacherSelector';
import type { User } from '../../../../types';

const mockTeachers: User[] = [
  { id: 'user-001', name: 'Budi Santoso', email: 'budi@uii.ac.id', role: 'pengajar', nim: '21511001' },
  { id: 'user-002', name: 'Ani Rahayu', email: 'ani@uii.ac.id', role: 'pengajar', nim: '21511002' },
  { id: 'user-003', name: 'Cici Dewi', email: 'cici@uii.ac.id', role: 'pengajar', nim: '21511003' },
];

describe('ExpectedTeacherSelector', () => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderComponent(currentUserId = 'user-001') {
    return render(
      <ExpectedTeacherSelector
        teachers={mockTeachers}
        currentUserId={currentUserId}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );
  }

  it('renders all teachers as checkboxes, all UNCHECKED by default', () => {
    renderComponent();
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText('Ani Rahayu')).toBeInTheDocument();
    expect(screen.getByText('Cici Dewi')).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
    checkboxes.forEach(cb => expect(cb).not.toBeChecked());
  });

  it('shows counter "0 dipilih" when nothing is checked', () => {
    renderComponent();
    expect(screen.getByText('0 dipilih')).toBeInTheDocument();
  });

  it('shows counter "2 dipilih" when two teachers are checked', () => {
    renderComponent();
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Budi
    fireEvent.click(checkboxes[2]); // Cici
    expect(screen.getByText('2 dipilih')).toBeInTheDocument();
  });

  it('submit button is disabled when 0 selected', () => {
    renderComponent();
    const submitBtn = screen.getByRole('button', { name: /Buka Sesi/ });
    expect(submitBtn).toBeDisabled();
  });

  it('submit button is enabled when at least 1 selected', () => {
    renderComponent();
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Budi
    const submitBtn = screen.getByRole('button', { name: /Buka Sesi/ });
    expect(submitBtn).not.toBeDisabled();
    expect(submitBtn).toHaveTextContent('Buka Sesi (1)');
  });

  it('shows explicit warning note when host (currentUserId) is not checked', () => {
    renderComponent('user-001');
    const checkboxes = screen.getAllByRole('checkbox');
    // Select Ani (user-002) but not Budi (user-001)
    fireEvent.click(checkboxes[1]);
    expect(screen.getByText(/Sebagai host/)).toBeInTheDocument();
    expect(screen.getAllByText(/Budi Santoso/).length).toBeGreaterThanOrEqual(2);
  });

  it('does not show warning note when host is checked', () => {
    renderComponent('user-001');
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Check Budi
    expect(screen.queryByText(/Sebagai host/)).not.toBeInTheDocument();
  });

  it('calls onSubmit with selected IDs when submit button clicked', () => {
    renderComponent();
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Budi
    fireEvent.click(checkboxes[2]); // Cici
    fireEvent.click(screen.getByRole('button', { name: /Buka Sesi/ }));
    expect(onSubmit).toHaveBeenCalledWith(['user-001', 'user-003']);
  });

  it('calls onCancel when cancel button clicked', () => {
    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: /Batal/ }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows loading state when loading prop is true', () => {
    render(
      <ExpectedTeacherSelector
        teachers={mockTeachers}
        currentUserId="user-001"
        onSubmit={onSubmit}
        onCancel={onCancel}
        loading={true}
      />
    );
    const submitBtn = screen.getByRole('button', { name: /Membuka/ });
    expect(submitBtn).toBeDisabled();
  });
});
