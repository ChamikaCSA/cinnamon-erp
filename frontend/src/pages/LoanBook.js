import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Paper,
  Chip,
  IconButton,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Payment as PaymentIcon,
  History as HistoryIcon,
  AccountBalance as LoanIcon,
  Payments as RepaymentIcon,
  Warning as AlertIcon,
  Groups as BorrowersIcon,
  AccountBalance as AccountBalanceIcon,
  Payments as PaymentsIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useCurrencyFormatter } from '../utils/currencyUtils';
import SummaryCard from '../components/common/SummaryCard';

const TabPanel = (props) => {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

const LoanBook = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loans, setLoans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [openLoanDialog, setOpenLoanDialog] = useState(false);
  const [openPaymentDialog, setOpenPaymentDialog] = useState(false);
  const [openHistoryDialog, setOpenHistoryDialog] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [summary, setSummary] = useState({
    totalLoaned: 0,
    totalRepaid: 0,
    outstandingAmount: 0,
    activeLoans: 0,
    overdueLoans: 0
  });

  const [loanFormData, setLoanFormData] = useState({
    borrower_type: 'employee',
    borrower_id: '',
    borrowerName: '',
    borrowerContact: '',
    amount: '',
    interestRate: '',
    term: '',
    startDate: '',
    endDate: '',
    purpose: '',
    collateral: '',
    status: 'active',
    paymentFrequency: 'monthly',
    notes: ''
  });

  const [paymentFormData, setPaymentFormData] = useState({
    loanId: '',
    amount: '',
    date: '',
    paymentMethod: '',
    reference: '',
    notes: ''
  });

  const [borrowers, setBorrowers] = useState([]);
  const [openPayrollDialog, setOpenPayrollDialog] = useState(false);
  const [payrollDetails, setPayrollDetails] = useState(null);
  const [employees, setEmployees] = useState([]);

  const { formatCurrency } = useCurrencyFormatter();

  useEffect(() => {
    fetchLoans();
    fetchPayments();
    fetchSummary();
    fetchEmployees();
  }, []);

  const fetchLoans = async () => {
    try {
      const response = await axios.get('/api/loans');
      setLoans(response.data);
    } catch (error) {
      console.error('Error fetching loans:', error);
    }
  };

  const fetchPayments = async () => {
    try {
      const response = await axios.get('/api/loans/payments');
      setPayments(response.data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await axios.get('/api/loans/summary');
      setSummary({
        totalLoaned: Number(response.data.totalLoaned) || 0,
        totalRepaid: Number(response.data.totalRepaid) || 0,
        outstandingAmount: Number(response.data.outstandingAmount) || 0,
        activeLoans: Number(response.data.activeLoans) || 0,
        overdueLoans: Number(response.data.overdueLoans) || 0
      });
    } catch (error) {
      console.error('Error fetching summary:', error);
      setSummary({
        totalLoaned: 0,
        totalRepaid: 0,
        outstandingAmount: 0,
        activeLoans: 0,
        overdueLoans: 0
      });
    }
  };

  const fetchBorrowers = async (type) => {
    try {
      const response = await axios.get(`/api/loans/borrowers?type=${type}`);
      setBorrowers(response.data);
    } catch (error) {
      console.error('Error fetching borrowers:', error);
      setBorrowers([]);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await axios.get('/api/employees');
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleOpenLoanDialog = (loan = null) => {
    if (loan) {
      setSelectedLoan(loan);
      setLoanFormData({
        borrower_type: loan.borrower_type,
        borrower_id: loan.borrower_id,
        borrowerName: loan.borrowerName,
        borrowerContact: loan.borrowerContact,
        amount: loan.amount,
        interestRate: loan.interestRate,
        term: loan.term,
        startDate: loan.startDate?.split('T')[0] || '',
        endDate: loan.endDate?.split('T')[0] || '',
        purpose: loan.purpose,
        collateral: loan.collateral,
        status: loan.status,
        paymentFrequency: loan.paymentFrequency,
        notes: loan.notes
      });
      fetchBorrowers(loan.borrower_type);
    } else {
      setSelectedLoan(null);
      setLoanFormData({
        borrower_type: 'employee',
        borrower_id: '',
        borrowerName: '',
        borrowerContact: '',
        amount: '',
        interestRate: '',
        term: '',
        startDate: '',
        endDate: '',
        purpose: '',
        collateral: '',
        status: 'active',
        paymentFrequency: 'monthly',
        notes: ''
      });
      fetchBorrowers('employee');
    }
    setOpenLoanDialog(true);
  };

  const handleOpenPaymentDialog = (loan) => {
    setSelectedLoan(loan);
    setPaymentFormData({
      loanId: loan.id,
      amount: '',
      date: '',
      paymentMethod: '',
      reference: '',
      notes: ''
    });
    setOpenPaymentDialog(true);
  };

  const handleOpenHistoryDialog = (loan) => {
    setSelectedLoan(loan);
    setOpenHistoryDialog(true);
  };

  const handleCloseLoanDialog = () => {
    setOpenLoanDialog(false);
    setSelectedLoan(null);
  };

  const handleClosePaymentDialog = () => {
    setOpenPaymentDialog(false);
    setSelectedLoan(null);
  };

  const handleCloseHistoryDialog = () => {
    setOpenHistoryDialog(false);
    setSelectedLoan(null);
  };

  const handleLoanInputChange = (e) => {
    setLoanFormData({
      ...loanFormData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePaymentInputChange = (e) => {
    setPaymentFormData({
      ...paymentFormData,
      [e.target.name]: e.target.value,
    });
  };

  const handleLoanSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedLoan) {
        await axios.put(`/api/loans/${selectedLoan.id}`, loanFormData);
      } else {
        await axios.post('/api/loans', loanFormData);
      }
      fetchLoans();
      fetchSummary();
      handleCloseLoanDialog();
    } catch (error) {
      console.error('Error saving loan:', error);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/loans/payments', paymentFormData);
      fetchLoans();
      fetchPayments();
      fetchSummary();
      handleClosePaymentDialog();
    } catch (error) {
      console.error('Error processing payment:', error);
    }
  };

  const handleDeleteLoan = async (loanId) => {
    if (window.confirm('Are you sure you want to delete this loan?')) {
      try {
        await axios.delete(`/api/loans/${loanId}`);
        fetchLoans();
        fetchSummary();
      } catch (error) {
        console.error('Error deleting loan:', error);
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'overdue':
        return 'error';
      case 'completed':
        return 'info';
      case 'defaulted':
        return 'warning';
      default:
        return 'default';
    }
  };

  const calculateRemainingAmount = (loan) => {
    const paidAmount = payments
      .filter(payment => payment.loanId === loan.id)
      .reduce((sum, payment) => sum + payment.amount, 0);
    return loan.amount - paidAmount;
  };

  useEffect(() => {
    if (openLoanDialog) {
      fetchBorrowers(loanFormData.borrower_type);
    }
  }, [loanFormData.borrower_type, openLoanDialog]);

  const handleViewPayroll = async (employeeId) => {
    try {
      const response = await axios.get(`/api/payroll/calculate/${employeeId}`);
      setPayrollDetails(response.data);
      setOpenPayrollDialog(true);
    } catch (error) {
      console.error('Error fetching payroll details:', error);
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Loan Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenLoanDialog()}
        >
          New Loan
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            icon={BorrowersIcon}
            title="Total Active Loans"
            value={summary.activeLoans}
            iconColor="#D32F2F"
            gradientColor="error"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            icon={AccountBalanceIcon}
            title="Total Loan Amount"
            value={formatCurrency(summary.totalLoaned)}
            iconColor="#9C27B0"
            gradientColor="secondary"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            icon={PaymentsIcon}
            title="Total Repaid"
            value={formatCurrency(summary.totalRepaid)}
            iconColor="#ED6C02"
            gradientColor="warning"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            icon={WarningIcon}
            title="Outstanding Balance"
            value={formatCurrency(summary.outstandingAmount)}
            iconColor="#0288D1"
            gradientColor="info"
          />
        </Grid>
      </Grid>

      <Paper
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            px: 2,
            pt: 2
          }}
        >
          <Tab label="Active Loans" />
          <Tab label="Payment History" />
        </Tabs>

        {/* Active Loans Tab */}
        <TabPanel value={tabValue} index={0}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Loan Number</TableCell>
                  <TableCell>Borrower</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Remaining</TableCell>
                  <TableCell>Interest Rate</TableCell>
                  <TableCell>Term (Months)</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell>{loan.loan_number}</TableCell>
                    <TableCell>{loan.borrower_name}</TableCell>
                    <TableCell>{formatCurrency(loan.amount)}</TableCell>
                    <TableCell>{formatCurrency(loan.remaining_balance)}</TableCell>
                    <TableCell>{loan.interest_rate}%</TableCell>
                    <TableCell>{loan.term_months}</TableCell>
                    <TableCell>
                      <Chip
                        label={loan.status}
                        color={getStatusColor(loan.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenPaymentDialog(loan)}
                        sx={{ color: 'success.main' }}
                      >
                        <PaymentIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenHistoryDialog(loan)}
                        sx={{ color: 'info.main' }}
                      >
                        <HistoryIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenLoanDialog(loan)}
                        sx={{ color: 'primary.main' }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteLoan(loan.id)}
                        sx={{ color: 'error.main' }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Payment History Tab */}
        <TabPanel value={tabValue} index={1}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Loan Number</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Reference</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Notes</TableCell>
                  <TableCell>Created By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {new Date(payment.payment_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{payment.loan_number}</TableCell>
                    <TableCell>
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell>{payment.reference}</TableCell>
                    <TableCell>
                      <Chip
                        label={payment.status}
                        color={getStatusColor(payment.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{payment.notes}</TableCell>
                    <TableCell>{payment.created_by_name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </Paper>

      {/* Loan Dialog */}
      <Dialog
        open={openLoanDialog}
        onClose={handleCloseLoanDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedLoan ? 'Edit Loan' : 'New Loan'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Borrower Type</InputLabel>
                <Select
                  name="borrower_type"
                  value={loanFormData.borrower_type}
                  label="Borrower Type"
                  onChange={handleLoanInputChange}
                >
                  <MenuItem value="employee">Employee</MenuItem>
                  <MenuItem value="contractor">Contractor</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              {loanFormData.borrower_type === 'employee' && (
                <FormControl fullWidth>
                  <InputLabel>Select Employee</InputLabel>
                  <Select
                    name="borrower_id"
                    value={loanFormData.borrower_id}
                    label="Select Employee"
                    onChange={handleLoanInputChange}
                    required
                  >
                    <MenuItem value="">Select Employee</MenuItem>
                    {employees.map((employee) => (
                      <MenuItem key={employee.id} value={employee.id}>
                        {employee.name} - {employee.nic}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Grid>
            <Grid item xs={6}>
              <TextField
                name="borrowerContact"
                label="Contact Information"
                fullWidth
                value={loanFormData.borrowerContact}
                onChange={handleLoanInputChange}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                name="amount"
                label="Loan Amount"
                type="number"
                fullWidth
                value={loanFormData.amount}
                onChange={handleLoanInputChange}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                name="interestRate"
                label="Interest Rate (%)"
                type="number"
                fullWidth
                value={loanFormData.interestRate}
                onChange={handleLoanInputChange}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                name="term"
                label="Loan Term (months)"
                type="number"
                fullWidth
                value={loanFormData.term}
                onChange={handleLoanInputChange}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Payment Frequency</InputLabel>
                <Select
                  name="paymentFrequency"
                  value={loanFormData.paymentFrequency}
                  label="Payment Frequency"
                  onChange={handleLoanInputChange}
                >
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                  <MenuItem value="quarterly">Quarterly</MenuItem>
                  <MenuItem value="annually">Annually</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                name="startDate"
                label="Start Date"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={loanFormData.startDate}
                onChange={handleLoanInputChange}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                name="endDate"
                label="End Date"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={loanFormData.endDate}
                onChange={handleLoanInputChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                name="purpose"
                label="Loan Purpose"
                fullWidth
                multiline
                rows={2}
                value={loanFormData.purpose}
                onChange={handleLoanInputChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                name="collateral"
                label="Collateral Details"
                fullWidth
                multiline
                rows={2}
                value={loanFormData.collateral}
                onChange={handleLoanInputChange}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  name="status"
                  value={loanFormData.status}
                  label="Status"
                  onChange={handleLoanInputChange}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="overdue">Overdue</MenuItem>
                  <MenuItem value="defaulted">Defaulted</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                name="notes"
                label="Additional Notes"
                fullWidth
                multiline
                rows={2}
                value={loanFormData.notes}
                onChange={handleLoanInputChange}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseLoanDialog}>Cancel</Button>
          <Button onClick={handleLoanSubmit} color="primary">
            {selectedLoan ? 'Update Loan' : 'Create Loan'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog
        open={openPaymentDialog}
        onClose={handleClosePaymentDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Record Payment</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Typography variant="subtitle1">
                Borrower: {selectedLoan?.borrowerName}
              </Typography>
              <Typography variant="subtitle2">
                Remaining Amount: ${selectedLoan ? calculateRemainingAmount(selectedLoan) : 0}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <TextField
                name="amount"
                label="Payment Amount"
                type="number"
                fullWidth
                value={paymentFormData.amount}
                onChange={handlePaymentInputChange}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                name="date"
                label="Payment Date"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={paymentFormData.date}
                onChange={handlePaymentInputChange}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                name="paymentMethod"
                label="Payment Method"
                fullWidth
                value={paymentFormData.paymentMethod}
                onChange={handlePaymentInputChange}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                name="reference"
                label="Reference Number"
                fullWidth
                value={paymentFormData.reference}
                onChange={handlePaymentInputChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                name="notes"
                label="Notes"
                fullWidth
                multiline
                rows={2}
                value={paymentFormData.notes}
                onChange={handlePaymentInputChange}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePaymentDialog}>Cancel</Button>
          <Button onClick={handlePaymentSubmit} color="primary">
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* History Dialog */}
      <Dialog
        open={openHistoryDialog}
        onClose={handleCloseHistoryDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Payment History</DialogTitle>
        <DialogContent>
          {selectedLoan && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Typography variant="subtitle1">
                  Borrower: {selectedLoan.borrowerName}
                </Typography>
                <Typography variant="subtitle2">
                  Loan Amount: ${selectedLoan.amount}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Reference</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Notes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {payments
                        .filter(payment => payment.loan_id === selectedLoan?.id)
                        .map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>
                              {new Date(payment.payment_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(payment.amount)}
                            </TableCell>
                            <TableCell>{payment.reference}</TableCell>
                            <TableCell>
                              <Chip
                                label={payment.status}
                                color={getStatusColor(payment.status)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>{payment.notes}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseHistoryDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openPayrollDialog}
        onClose={() => setOpenPayrollDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Employee Payroll Details</DialogTitle>
        <DialogContent>
          {payrollDetails && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Typography variant="h6">
                  {payrollDetails.employeeName}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle1">Basic Salary</Typography>
                <Typography variant="h6">
                  ${payrollDetails.basicSalary.toFixed(2)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle1">Gross Salary</Typography>
                <Typography variant="h6">
                  ${payrollDetails.grossSalary.toFixed(2)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle1">Earnings</Typography>
                {payrollDetails.earnings.map((earning, index) => (
                  <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>{earning.name}</Typography>
                    <Typography>${earning.amount.toFixed(2)}</Typography>
                  </Box>
                ))}
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle1">Deductions</Typography>
                {payrollDetails.deductions.map((deduction, index) => (
                  <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>{deduction.name}</Typography>
                    <Typography>${deduction.amount.toFixed(2)}</Typography>
                  </Box>
                ))}
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle1">Net Salary</Typography>
                <Typography variant="h5" color="primary">
                  ${payrollDetails.netSalary.toFixed(2)}
                </Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPayrollDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LoanBook;