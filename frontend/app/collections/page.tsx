'use client';

import { useState, useEffect } from 'react';
import { get, post, del } from '@/lib/api';
import { getAuthHeader } from '@/lib/auth';

interface PaymentPlan {
  id: number;
  statement_id: number;
  patient_name: string;
  total_amount: number;
  remaining_balance: number;
  monthly_payment_amount: number;
  number_of_payments: number;
  payment_frequency: string;
  next_payment_date: string;
  status: string;
  statement_number?: string;
  scheduled_payments?: any[];
}

interface OverdueReminder {
  id: number;
  statement_id: number;
  patient_name: string;
  balance_amount: number;
  days_overdue: number;
  reminder_type: string;
  reminder_status: string;
  scheduled_send_date: string;
  sent_at: string;
  statement_number?: string;
}

interface DoNotCall {
  id: number;
  phone_number: string;
  patient_name: string;
  reason: string;
  added_at: string;
}

interface ConsentRecord {
  id: number;
  patient_identifier: string;
  consent_type: string;
  consent_status: string;
  consent_date: string;
  expiration_date: string;
}

interface CollectionsCase {
  id: number;
  statement_id: number;
  patient_name: string;
  balance_amount: number;
  days_overdue: number;
  case_status: string;
  statement_number?: string;
}

export default function CollectionsPage() {
  const [activeTab, setActiveTab] = useState<'payment-plans' | 'reminders' | 'do-not-call' | 'consent' | 'cases'>('payment-plans');
  const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);
  const [reminders, setReminders] = useState<OverdueReminder[]>([]);
  const [doNotCallList, setDoNotCallList] = useState<DoNotCall[]>([]);
  const [consentRecords, setConsentRecords] = useState<ConsentRecord[]>([]);
  const [cases, setCases] = useState<CollectionsCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'payment-plans') {
        const response = await get('/api/collections/payment-plans');
        setPaymentPlans(response.payment_plans || []);
      } else if (activeTab === 'reminders') {
        const response = await get('/api/collections/reminders');
        setReminders(response.reminders || []);
      } else if (activeTab === 'do-not-call') {
        const response = await get('/api/collections/do-not-call');
        setDoNotCallList(response.do_not_call_list || []);
      } else if (activeTab === 'consent') {
        const response = await get('/api/collections/consent-records');
        setConsentRecords(response.consent_records || []);
      } else if (activeTab === 'cases') {
        const response = await get('/api/collections/cases');
        setCases(response.cases || []);
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'sent':
      case 'granted':
        return 'bg-green-500/20 text-green-300';
      case 'pending':
      case 'scheduled':
        return 'bg-yellow-500/20 text-yellow-300';
      case 'completed':
      case 'paid':
        return 'bg-blue-500/20 text-blue-300';
      case 'failed':
      case 'revoked':
      case 'cancelled':
        return 'bg-red-500/20 text-red-300';
      default:
        return 'bg-slate-500/20 text-slate-300';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Collections Management</h1>
          <p className="text-slate-300">Manage payment plans, reminders, and TCPA compliance</p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 flex-wrap">
          {(['payment-plans', 'reminders', 'do-not-call', 'consent', 'cases'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                activeTab === tab
                  ? 'bg-teal-500 text-white'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              {tab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </button>
          ))}
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
            {/* Payment Plans Tab */}
            {activeTab === 'payment-plans' && (
              <div className="space-y-4">
                {paymentPlans.length === 0 ? (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
                    <p className="text-slate-300">No payment plans found</p>
                  </div>
                ) : (
                  paymentPlans.map((plan) => (
                    <div
                      key={plan.id}
                      className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-white mb-2">
                            Payment Plan #{plan.id}
                          </h3>
                          <p className="text-slate-300 text-sm">Patient: {plan.patient_name}</p>
                          {plan.statement_number && (
                            <p className="text-slate-300 text-sm">Statement: {plan.statement_number}</p>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(plan.status)}`}>
                          {plan.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div>
                          <p className="text-slate-400 text-sm">Total Amount</p>
                          <p className="text-white font-semibold">${parseFloat(plan.total_amount).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm">Remaining Balance</p>
                          <p className="text-white font-semibold">${parseFloat(plan.remaining_balance).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm">Monthly Payment</p>
                          <p className="text-white font-semibold">${parseFloat(plan.monthly_payment_amount).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm">Next Payment</p>
                          <p className="text-white font-semibold">
                            {plan.next_payment_date ? new Date(plan.next_payment_date).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Reminders Tab */}
            {activeTab === 'reminders' && (
              <div className="space-y-4">
                {reminders.length === 0 ? (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
                    <p className="text-slate-300">No reminders found</p>
                  </div>
                ) : (
                  reminders.map((reminder) => (
                    <div
                      key={reminder.id}
                      className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-white mb-2">
                            Reminder #{reminder.id}
                          </h3>
                          <p className="text-slate-300 text-sm">Patient: {reminder.patient_name}</p>
                          <p className="text-slate-300 text-sm">
                            Balance: ${parseFloat(reminder.balance_amount).toFixed(2)} ({reminder.days_overdue} days overdue)
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(reminder.reminder_status)}`}>
                          {reminder.reminder_status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div>
                          <p className="text-slate-400 text-sm">Type</p>
                          <p className="text-white font-semibold uppercase">{reminder.reminder_type}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm">Scheduled</p>
                          <p className="text-white font-semibold">
                            {new Date(reminder.scheduled_send_date).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm">Sent At</p>
                          <p className="text-white font-semibold">
                            {reminder.sent_at ? new Date(reminder.sent_at).toLocaleString() : 'Not sent'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm">Days Overdue</p>
                          <p className="text-white font-semibold">{reminder.days_overdue}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Do Not Call Tab */}
            {activeTab === 'do-not-call' && (
              <div className="space-y-4">
                {doNotCallList.length === 0 ? (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
                    <p className="text-slate-300">No entries in Do Not Call list</p>
                  </div>
                ) : (
                  doNotCallList.map((dnc) => (
                    <div
                      key={dnc.id}
                      className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-semibold text-white mb-2">{dnc.phone_number}</h3>
                          {dnc.patient_name && (
                            <p className="text-slate-300 text-sm">Patient: {dnc.patient_name}</p>
                          )}
                          <p className="text-slate-300 text-sm">Reason: {dnc.reason}</p>
                          <p className="text-slate-300 text-sm">
                            Added: {new Date(dnc.added_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Consent Records Tab */}
            {activeTab === 'consent' && (
              <div className="space-y-4">
                {consentRecords.length === 0 ? (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
                    <p className="text-slate-300">No consent records found</p>
                  </div>
                ) : (
                  consentRecords.map((consent) => (
                    <div
                      key={consent.id}
                      className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-white mb-2">
                            {consent.patient_identifier}
                          </h3>
                          <p className="text-slate-300 text-sm">Type: {consent.consent_type}</p>
                          <p className="text-slate-300 text-sm">
                            Date: {new Date(consent.consent_date).toLocaleDateString()}
                          </p>
                          {consent.expiration_date && (
                            <p className="text-slate-300 text-sm">
                              Expires: {new Date(consent.expiration_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(consent.consent_status)}`}>
                          {consent.consent_status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Collections Cases Tab */}
            {activeTab === 'cases' && (
              <div className="space-y-4">
                {cases.length === 0 ? (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
                    <p className="text-slate-300">No collections cases found</p>
                  </div>
                ) : (
                  cases.map((caseItem) => (
                    <div
                      key={caseItem.id}
                      className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-white mb-2">
                            Case #{caseItem.id}
                          </h3>
                          <p className="text-slate-300 text-sm">Patient: {caseItem.patient_name}</p>
                          <p className="text-slate-300 text-sm">
                            Balance: ${parseFloat(caseItem.balance_amount).toFixed(2)} ({caseItem.days_overdue} days overdue)
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(caseItem.case_status)}`}>
                          {caseItem.case_status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

