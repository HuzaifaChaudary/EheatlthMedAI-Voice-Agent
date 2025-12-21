'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { get, post } from '@/lib/api';
import { getAuthHeader } from '@/lib/auth';

interface Statement {
  id: number;
  statement_number: string;
  statement_date: string;
  total_amount: number;
  balance_due: number;
  status: string;
  patient_name: string;
  line_items?: any[];
}

interface Payment {
  id: number;
  payment_amount: number;
  payment_method: string;
  payment_status: string;
  payment_date: string;
  patient_name: string;
  statement_number?: string;
  gateway_transaction_id?: string;
}

interface Receipt {
  id: number;
  receipt_number: string;
  receipt_date: string;
  payment_amount: number;
  payment_method: string;
  patient_name: string;
  receipt_pdf_url: string;
  sent_via_email: boolean;
  sent_via_sms: boolean;
}

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState<'statements' | 'payments' | 'receipts'>('statements');
  const [statements, setStatements] = useState<Statement[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'statements') {
        const response = await get<{ statements: Statement[] }>('/api/billing/statements');
        if (response.ok && response.data) {
          setStatements(Array.isArray(response.data.statements) ? response.data.statements : []);
        } else {
          setStatements([]);
          if (response.error) setError(response.error);
        }
      } else if (activeTab === 'payments') {
        const response = await get<{ payments: Payment[] }>('/api/billing/payments');
        if (response.ok && response.data) {
          setPayments(Array.isArray(response.data.payments) ? response.data.payments : []);
        } else {
          setPayments([]);
          if (response.error) setError(response.error);
        }
      } else if (activeTab === 'receipts') {
        const response = await get<{ receipts: Receipt[] }>('/api/billing/receipts');
        if (response.ok && response.data) {
          setReceipts(Array.isArray(response.data.receipts) ? response.data.receipts : []);
        } else {
          setReceipts([]);
          if (response.error) setError(response.error);
        }
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Error loading data');
      // Reset state on error
      setStatements([]);
      setPayments([]);
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  };

  const downloadReceipt = async (receiptId: number, receiptNumber: string) => {
    try {
      const token = getAuthHeader();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/billing/receipts/${receiptId}/download`, {
        headers: {
          'Authorization': token || ''
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download receipt');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${receiptNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Error downloading receipt:', err);
      alert('Failed to download receipt: ' + err.message);
    }
  };

  // Helper function to safely format currency
  const formatCurrency = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') {
      return '$0.00';
    }
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    if (isNaN(num)) {
      return '$0.00';
    }
    return `$${num.toFixed(2)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
      case 'completed':
        return 'bg-green-500/20 text-green-300';
      case 'pending':
      case 'processing':
        return 'bg-yellow-500/20 text-yellow-300';
      case 'overdue':
      case 'failed':
        return 'bg-red-500/20 text-red-300';
      case 'partial':
        return 'bg-blue-500/20 text-blue-300';
      default:
        return 'bg-slate-500/20 text-slate-300';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <header className="container mx-auto px-6 py-6 flex justify-between items-center">
        <Link href="/dashboard" className="text-white hover:text-slate-300 text-sm">
          ← Dashboard
        </Link>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Billing Management</h1>
          <p className="text-slate-300">Manage patient statements, payments, and receipts</p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTab('statements')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === 'statements'
                ? 'bg-teal-500 text-white'
                : 'bg-white/10 text-slate-300 hover:bg-white/20'
            }`}
          >
            Statements
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === 'payments'
                ? 'bg-teal-500 text-white'
                : 'bg-white/10 text-slate-300 hover:bg-white/20'
            }`}
          >
            Payments
          </button>
          <button
            onClick={() => setActiveTab('receipts')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === 'receipts'
                ? 'bg-teal-500 text-white'
                : 'bg-white/10 text-slate-300 hover:bg-white/20'
            }`}
          >
            Receipts
          </button>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500"></div>
            <p className="text-slate-300 mt-4">Loading...</p>
          </div>
        ) : (
          <>
            {/* Statements Tab */}
            {activeTab === 'statements' && (
              <div className="space-y-4">
                {statements.length === 0 ? (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
                    <p className="text-slate-300">No statements found</p>
                  </div>
                ) : (
                  statements.map((statement) => (
                    <div
                      key={statement.id}
                      className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-white mb-2">
                            Statement #{statement.statement_number}
                          </h3>
                          <p className="text-slate-300 text-sm">
                            Patient: {statement.patient_name}
                          </p>
                          <p className="text-slate-300 text-sm">
                            Date: {new Date(statement.statement_date).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(statement.status)}`}>
                          {statement.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div>
                          <p className="text-slate-400 text-sm">Total Amount</p>
                          <p className="text-white font-semibold">{formatCurrency(statement.total_amount)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm">Balance Due</p>
                          <p className="text-white font-semibold">{formatCurrency(statement.balance_due)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm">Status</p>
                          <p className="text-white font-semibold capitalize">{statement.status}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm">Line Items</p>
                          <p className="text-white font-semibold">
                            {statement.line_items?.length || 0} items
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Payments Tab */}
            {activeTab === 'payments' && (
              <div className="space-y-4">
                {payments.length === 0 ? (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
                    <p className="text-slate-300">No payments found</p>
                  </div>
                ) : (
                  payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-white mb-2">
                            Payment #{payment.id}
                          </h3>
                          <p className="text-slate-300 text-sm">
                            Patient: {payment.patient_name}
                          </p>
                          {payment.statement_number && (
                            <p className="text-slate-300 text-sm">
                              Statement: {payment.statement_number}
                            </p>
                          )}
                          <p className="text-slate-300 text-sm">
                            Date: {new Date(payment.payment_date).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(payment.payment_status)}`}>
                          {payment.payment_status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div>
                          <p className="text-slate-400 text-sm">Amount</p>
                          <p className="text-white font-semibold text-lg">
                            {formatCurrency(payment.payment_amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm">Method</p>
                          <p className="text-white font-semibold capitalize">
                            {payment.payment_method.replace('_', ' ')}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm">Status</p>
                          <p className="text-white font-semibold capitalize">{payment.payment_status}</p>
                        </div>
                        {payment.gateway_transaction_id && (
                          <div>
                            <p className="text-slate-400 text-sm">Transaction ID</p>
                            <p className="text-white font-semibold text-xs break-all">
                              {payment.gateway_transaction_id}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Receipts Tab */}
            {activeTab === 'receipts' && (
              <div className="space-y-4">
                {receipts.length === 0 ? (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
                    <p className="text-slate-300">No receipts found</p>
                  </div>
                ) : (
                  receipts.map((receipt) => (
                    <div
                      key={receipt.id}
                      className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-white mb-2">
                            Receipt #{receipt.receipt_number}
                          </h3>
                          <p className="text-slate-300 text-sm">
                            Patient: {receipt.patient_name}
                          </p>
                          <p className="text-slate-300 text-sm">
                            Date: {new Date(receipt.receipt_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          {receipt.sent_via_email && (
                            <span className="px-2 py-1 rounded bg-green-500/20 text-green-300 text-xs">
                              Email Sent
                            </span>
                          )}
                          {receipt.sent_via_sms && (
                            <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 text-xs">
                              SMS Sent
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div>
                          <p className="text-slate-400 text-sm">Amount</p>
                          <p className="text-white font-semibold text-lg">
                            {formatCurrency(receipt.payment_amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm">Method</p>
                          <p className="text-white font-semibold capitalize">
                            {receipt.payment_method.replace('_', ' ')}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm">Receipt Number</p>
                          <p className="text-white font-semibold">{receipt.receipt_number}</p>
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={() => downloadReceipt(receipt.id, receipt.receipt_number)}
                            className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors"
                          >
                            Download PDF
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

