import React, { useState } from 'react';
import { 
  Stethoscope, AlertCircle, ShieldCheck, Clock, MapPin, Search, X, 
  CheckCircle2, MessageSquare, ExternalLink, Sparkles, Filter, User, Send, Edit3
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { formatDateTime } from '../utils/dateUtils';

export default function DoctorDashboard({
  user,
  triageHistory,
  onVerifyTriage,
  setSelectedHistoryItem
}) {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'pending', 'verified'
  
  // Verification Modal state
  const [verifyingTriage, setVerifyingTriage] = useState(null);
  const [docUrgency, setDocUrgency] = useState('Red');
  const [docSymptomsText, setDocSymptomsText] = useState('');
  const [docMessage, setDocMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Extract unique villages
  const villages = ['All', ...new Set(triageHistory.map(item => item.village).filter(Boolean))];

  // Filtering
  const filteredTriages = triageHistory.filter(item => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      (item.patientName && item.patientName.toLowerCase().includes(searchLower)) ||
      (item.ashaName && item.ashaName.toLowerCase().includes(searchLower)) ||
      (item.symptoms && item.symptoms.join(', ').toLowerCase().includes(searchLower)) ||
      (item.transcript && item.transcript.toLowerCase().includes(searchLower));

    const matchesVillage = selectedVillage === 'All' ? true : item.village === selectedVillage;
    
    let matchesStatus = true;
    if (statusFilter === 'pending') {
      matchesStatus = item.doctorVerificationStatus === 'pending' || !item.doctorVerificationStatus;
    } else if (statusFilter === 'verified') {
      matchesStatus = item.doctorVerificationStatus === 'verified' || item.doctorVerificationStatus === 'modified';
    } else if (statusFilter === 'red') {
      matchesStatus = item.urgency === 'Red' || item.doctorUrgency === 'Red';
    }

    return matchesSearch && matchesVillage && matchesStatus;
  });

  // Calculations
  const pendingCount = triageHistory.filter(item => item.doctorVerificationStatus === 'pending' || !item.doctorVerificationStatus).length;
  const criticalRedCount = triageHistory.filter(item => (item.urgency === 'Red' || item.doctorUrgency === 'Red') && !item.resolved).length;
  const verifiedCount = triageHistory.filter(item => item.doctorVerificationStatus === 'verified' || item.doctorVerificationStatus === 'modified').length;

  const handleOpenVerifyModal = (e, item) => {
    e.stopPropagation();
    setVerifyingTriage(item);
    setDocUrgency(item.doctorUrgency || item.urgency || 'Green');
    const existingSymptoms = item.doctorSymptoms && item.doctorSymptoms.length > 0 ? item.doctorSymptoms : (item.symptoms || []);
    setDocSymptomsText(existingSymptoms.join(', '));
    setDocMessage(item.doctorMessage || (
      item.urgency === 'Red' 
        ? 'Urgent medical attention required. Please administer immediate stabilization, keep patient calm, and transfer to District Hospital immediately.' 
        : item.urgency === 'Yellow'
        ? 'Administer oral rehydration / basic fever management. Keep under observation and visit Sub-Centre if symptoms escalate.'
        : 'Symptomatic relief and warm fluids recommended. Monitor for any worsening symptoms.'
    ));
  };

  const handleConfirmVerification = async (e) => {
    e.preventDefault();
    if (!verifyingTriage) return;

    setSubmitting(true);

    const parsedSymptoms = docSymptomsText.split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const verificationPayload = {
      verifiedBy: user?.name || 'Dr. Medical Officer',
      doctorUrgency: docUrgency,
      doctorSymptoms: parsedSymptoms.length > 0 ? parsedSymptoms : verifyingTriage.symptoms,
      doctorMessage: docMessage.trim()
    };

    await onVerifyTriage(verifyingTriage.id, verificationPayload);

    setSubmitting(false);
    setVerifyingTriage(null);
  };

  return (
    <div className="space-y-6 fade-in-view">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#0A2540] to-[#123152] p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-white/10 text-[#E07A5F] rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border border-white/10">
              <Stethoscope className="w-3.5 h-3.5" />
              {t('doctor_workspace_title')}
            </span>
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-white">
            {t('namaste')}, {user?.name || 'Doctor'} 👋
          </h1>
          <p className="text-xs md:text-sm text-slate-300 font-medium">
            Review AI voice symptom extractions, verify triage urgency, and send direct treatment guidance to ASHA workers.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-300 block">Pending Verification</span>
            <span className="text-xl font-black text-amber-400">{pendingCount}</span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          onClick={() => setStatusFilter('pending')}
          className={`p-5 rounded-3xl border transition-all cursor-pointer shadow-soft flex items-center justify-between ${
            statusFilter === 'pending' ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400' : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 relative">
              {pendingCount > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-amber-600 animate-ping"></span>}
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('pending_doctor_verification')}</span>
              <span className="text-2xl font-black text-slate-900">{pendingCount}</span>
            </div>
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter('red')}
          className={`p-5 rounded-3xl border transition-all cursor-pointer shadow-soft flex items-center justify-between ${
            statusFilter === 'red' ? 'bg-red-50/80 border-red-300 ring-2 ring-red-400' : 'bg-white border-slate-200 hover:border-red-300'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center shrink-0 relative">
              {criticalRedCount > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>}
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('red_alerts')}</span>
              <span className={`text-2xl font-black ${criticalRedCount > 0 ? 'text-red-600' : 'text-slate-700'}`}>{criticalRedCount}</span>
            </div>
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter('verified')}
          className={`p-5 rounded-3xl border transition-all cursor-pointer shadow-soft flex items-center justify-between ${
            statusFilter === 'verified' ? 'bg-green-50/80 border-green-300 ring-2 ring-green-400' : 'bg-white border-slate-200 hover:border-green-300'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-green-100 text-green-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('verified_by_doctor')}</span>
              <span className="text-2xl font-black text-slate-900">{verifiedCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Verification Feed Section */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading font-extrabold text-xl text-[#0A2540]">{t('doctor_dashboard_title')}</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
              {filteredTriages.length} Records
            </span>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            {/* Status Filter Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button 
                onClick={() => setStatusFilter('All')}
                className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'All' ? 'bg-white text-[#0A2540] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                All
              </button>
              <button 
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${statusFilter === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Pending ({pendingCount})
              </button>
              <button 
                onClick={() => setStatusFilter('verified')}
                className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'verified' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Verified
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search_placeholder')}
                className="pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none focus:border-[#E07A5F]"
              />
            </div>

            {/* Village Selector */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <select 
                value={selectedVillage}
                onChange={(e) => setSelectedVillage(e.target.value)}
                className="py-1.5 text-xs font-semibold text-slate-700 bg-white focus:outline-none cursor-pointer"
              >
                {villages.map(v => (
                  <option key={v} value={v}>{v === 'All' ? t('all_villages') : v}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Triage Cards Feed */}
        {filteredTriages.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center bg-white/50 text-slate-400">
            <p className="text-sm font-medium">{t('no_logs_match')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTriages.map((item) => {
              const isVerified = item.doctorVerificationStatus === 'verified' || item.doctorVerificationStatus === 'modified';
              const currentUrgency = item.doctorUrgency || item.urgency;
              const displaySymptoms = item.doctorSymptoms && item.doctorSymptoms.length > 0 ? item.doctorSymptoms : (item.symptoms || []);

              return (
                <div 
                  key={item.id}
                  onClick={() => setSelectedHistoryItem(item)}
                  className={`bg-white border-2 rounded-3xl p-5 shadow-soft hover:shadow-lg transition-all flex flex-col justify-between cursor-pointer ${
                    !isVerified 
                      ? 'border-amber-300 ring-2 ring-amber-100 bg-amber-50/20' 
                      : 'border-slate-200'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Card Top Header */}
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-heading font-extrabold text-base text-[#0A2540]">{item.patientName}</h3>
                          <span className="text-xs text-slate-500 font-semibold">({item.patientDetails})</span>
                        </div>
                        <p className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          Village: <span className="font-bold text-slate-700">{item.village}</span> · ASHA: <span className="font-bold text-slate-700">{item.ashaName || 'Sunita Devi'}</span>
                        </p>
                      </div>

                      {/* Verification Status Badge */}
                      {isVerified ? (
                        <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 border border-green-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                          Verified
                        </span>
                      ) : (
                        <button
                          onClick={(e) => handleOpenVerifyModal(e, item)}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 shrink-0 shadow-md transition-all active:scale-95 animate-bounce"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Verify Triage
                        </button>
                      )}
                    </div>

                    {/* AI Extracted Symptoms Chips */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                        Extracted Clinical Symptoms ({isVerified ? 'Doctor Verified' : 'AI Extracted'})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {displaySymptoms.map((sym, idx) => (
                          <span key={idx} className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200">
                            {sym}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Voice Spoken Speech & Translation */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">
                        Spoken Voice ({item.language || 'Hindi'}):
                      </span>
                      <p className="text-xs text-slate-800 font-semibold italic">"{item.transcript}"</p>
                      {item.translation && item.translation !== item.transcript && (
                        <p className="text-[11px] text-slate-500 font-medium border-t border-slate-200/60 pt-1 mt-1">
                          En: "{item.translation}"
                        </p>
                      )}
                    </div>

                    {/* Doctor's Note if verified */}
                    {isVerified && item.doctorMessage && (
                      <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl space-y-1">
                        <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                          Doctor's Message to ASHA Worker:
                        </span>
                        <p className="text-xs text-emerald-900 font-bold leading-relaxed">
                          "{item.doctorMessage}"
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        currentUrgency === 'Red' ? 'bg-red-600 text-white' : currentUrgency === 'Yellow' ? 'bg-amber-500 text-white' : 'bg-green-600 text-white'
                      }`}>
                        {currentUrgency} Urgency
                      </span>
                      <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {formatDateTime(item.createdAt || item.date)}
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleOpenVerifyModal(e, item)}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md ${
                        isVerified 
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300' 
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 hover:scale-[1.02]'
                      }`}
                    >
                      {isVerified ? (
                        <>
                          <Edit3 className="w-4 h-4 text-slate-600" />
                          Edit Verification
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-white" />
                          Verify & Send Message
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Doctor Verification Interactive Modal */}
      {verifyingTriage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A2540]/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#0A2540] text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Stethoscope className="w-5 h-5 text-[#E07A5F]" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-lg">{t('verify_triage_action')}</h3>
                  <p className="text-xs text-white/70">
                    Patient: <span className="font-bold text-[#E07A5F]">{verifyingTriage.patientName}</span> ({verifyingTriage.patientDetails} · {verifyingTriage.village})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setVerifyingTriage(null)}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleConfirmVerification} className="p-6 overflow-y-auto space-y-5 flex-grow text-left">
              
              {/* Spoken Speech Summary */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Original Voice Input from ASHA ({verifyingTriage.ashaName || 'Sunita Devi'})</span>
                  <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {formatDateTime(verifyingTriage.createdAt || verifyingTriage.date)}
                  </span>
                </div>
                <p className="text-xs text-slate-800 font-bold italic">"{verifyingTriage.transcript}"</p>
                {verifyingTriage.translation && (
                  <p className="text-xs text-slate-600 font-medium border-t border-slate-200/70 pt-1 mt-1">
                    En: "{verifyingTriage.translation}"
                  </p>
                )}
              </div>

              {/* Triage Urgency Level Radio Buttons */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Verify or Upgrade Urgency Level:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDocUrgency('Red')}
                    className={`py-2.5 px-3 rounded-2xl border text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                      docUrgency === 'Red' 
                        ? 'bg-red-600 text-white border-red-700 shadow-md ring-2 ring-red-400' 
                        : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4" />
                    Critical Red
                  </button>

                  <button
                    type="button"
                    onClick={() => setDocUrgency('Yellow')}
                    className={`py-2.5 px-3 rounded-2xl border text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                      docUrgency === 'Yellow' 
                        ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-400' 
                        : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    Yellow Alert
                  </button>

                  <button
                    type="button"
                    onClick={() => setDocUrgency('Green')}
                    className={`py-2.5 px-3 rounded-2xl border text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                      docUrgency === 'Green' 
                        ? 'bg-green-600 text-white border-green-700 shadow-md ring-2 ring-green-400' 
                        : 'bg-green-50 text-green-800 border-green-200 hover:bg-green-100'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Green Status
                  </button>
                </div>
              </div>

              {/* Verified Symptoms Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Clinical Symptoms (Comma Separated):
                </label>
                <textarea
                  rows={2}
                  value={docSymptomsText}
                  onChange={(e) => setDocSymptomsText(e.target.value)}
                  placeholder="e.g. High Fever (>102°F), Respiratory Distress, Lethargy"
                  className="w-full p-3 text-xs rounded-xl border border-slate-200 font-semibold text-slate-800 focus:outline-none focus:border-[#E07A5F]"
                />
              </div>

              {/* Doctor Message to ASHA Worker Textarea */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <MessageSquare className="w-4 h-4 text-[#E07A5F]" />
                  Direct Instructions & Message to ASHA ({verifyingTriage.ashaName || 'Sunita Devi'}):
                </label>
                <textarea
                  rows={3}
                  value={docMessage}
                  onChange={(e) => setDocMessage(e.target.value)}
                  placeholder={t('doctor_message_placeholder')}
                  className="w-full p-3 text-xs rounded-xl border border-slate-200 font-semibold text-slate-800 focus:outline-none focus:border-[#E07A5F] bg-slate-50"
                  required
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setVerifyingTriage(null)}
                  className="w-1/3 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all"
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-2/3 py-3 rounded-xl bg-[#0A2540] hover:bg-[#123152] text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                >
                  <Send className="w-4 h-4 text-[#E07A5F]" />
                  {submitting ? 'Submitting Verification...' : t('confirm_triage_btn')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
