import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ExpenseCategory, ExpenseDocument } from '../types';
import { useAuth } from '../hooks/useAuth';
import useToast from '../hooks/useToast';
import { databaseService } from '../services/databaseService';

interface AddExpenseInput {
  projectId?: string | null;
  tripId?: string | null;
  category: ExpenseCategory;
  amount: number;
  currency?: string | null;
  description?: string | null;
  invoiceDate?: string | null;
  file: File;
}

interface ExpensesContextValue {
  expenses: ExpenseDocument[];
  loading: boolean;
  error: string | null;
  refreshExpenses: () => Promise<void>;
  addExpense: (input: AddExpenseInput) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;
  getExpensesForTrip: (tripId: string) => ExpenseDocument[];
  getExpensesForProject: (projectId: string) => ExpenseDocument[];
}

const ExpensesContext = createContext<ExpensesContextValue | undefined>(undefined);

export const ExpensesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [expenses, setExpenses] = useState<ExpenseDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshExpenses = useCallback(async () => {
    if (!user?.id) {
      setExpenses([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await databaseService.getUserExpenses(user.id);
      setExpenses(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load expenses';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [user?.id, showToast]);

  useEffect(() => {
    refreshExpenses();
  }, [refreshExpenses]);

  const addExpense = useCallback(async (input: AddExpenseInput) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    try {
      const newExpense = await databaseService.addExpenseDocument(user.id, input);
      setExpenses(prev => [newExpense, ...prev]);
      showToast('Invoice uploaded successfully', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload invoice';
      showToast(message, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.id, showToast]);

  const deleteExpense = useCallback(async (expenseId: string) => {
    setLoading(true);
    try {
      await databaseService.deleteExpenseDocument(expenseId);
      setExpenses(prev => prev.filter(expense => expense.id !== expenseId));
      showToast('Invoice deleted', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete invoice';
      showToast(message, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const getExpensesForTrip = useCallback((tripId: string) => {
    return expenses.filter(expense => expense.tripId === tripId);
  }, [expenses]);

  const getExpensesForProject = useCallback((projectId: string) => {
    return expenses.filter(expense => expense.projectId === projectId);
  }, [expenses]);

  const value = useMemo<ExpensesContextValue>(() => ({
    expenses,
    loading,
    error,
    refreshExpenses,
    addExpense,
    deleteExpense,
    getExpensesForTrip,
    getExpensesForProject,
  }), [expenses, loading, error, refreshExpenses, addExpense, deleteExpense, getExpensesForTrip, getExpensesForProject]);

  return (
    <ExpensesContext.Provider value={value}>
      {children}
    </ExpensesContext.Provider>
  );
};

export const useExpensesContext = (): ExpensesContextValue => {
  const context = useContext(ExpensesContext);
  if (!context) {
    throw new Error('useExpensesContext must be used within an ExpensesProvider');
  }
  return context;
};
