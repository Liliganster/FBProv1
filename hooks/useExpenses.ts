import { useExpensesContext } from '../context/ExpensesContext';

const useExpenses = () => {
  return useExpensesContext();
};

export default useExpenses;
