import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';

export default function AddPatient({
  handleAddPatient
}) {
  const [newPatient, setNewPatient] = useState({
    name: '',
    age: '',
    gender: 'Female',
    village: '',
    phone: '',
    notes: ''
  });

  const handleSubmit = (e, andStartTriage = false) => {
    e.preventDefault();
    handleAddPatient(newPatient, andStartTriage);
    
    // Reset local fields
    setNewPatient({
      name: '',
      age: '',
      gender: 'Female',
      village: '',
      phone: '',
      notes: ''
    });
  };

  return (
    <div className="max-w-xl mx-auto fade-in-view space-y-6">
      <h1 className="font-heading text-3xl font-extrabold text-[#0A2540]">Add new patient</h1>
      
      <form onSubmit={(e) => handleSubmit(e, false)} className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
        {/* Full Name */}
        <div>
          <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-2">Full Name</label>
          <input 
            type="text"
            required
            value={newPatient.name}
            onChange={(e) => setNewPatient(prev => ({ ...prev, name: e.target.value }))}
            className="w-full min-h-[50px] px-4 rounded-xl border border-slate-200 focus:border-[#E07A5F] focus:outline-none text-slate-700 font-medium"
            placeholder="e.g. Ramesh Kumar"
          />
        </div>

        {/* Age */}
        <div>
          <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-2">Age</label>
          <input 
            type="number"
            required
            min="0"
            max="125"
            value={newPatient.age}
            onChange={(e) => setNewPatient(prev => ({ ...prev, age: e.target.value }))}
            className="w-full min-h-[50px] px-4 rounded-xl border border-slate-200 focus:border-[#E07A5F] focus:outline-none text-slate-700 font-medium"
            placeholder="e.g. 35"
          />
        </div>

        {/* Gender Radio buttons */}
        <div>
          <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-2.5">Gender</label>
          <div className="grid grid-cols-3 gap-2">
            {['Female', 'Male', 'Other'].map((genderOption) => (
              <button
                key={genderOption}
                type="button"
                onClick={() => setNewPatient(prev => ({ ...prev, gender: genderOption }))}
                className={`py-3.5 rounded-xl border-2 font-bold text-sm transition-all ${
                  newPatient.gender === genderOption
                    ? 'border-[#0A2540] bg-slate-50 text-[#0A2540]'
                    : 'border-slate-100 hover:border-slate-200 text-slate-500'
                }`}
              >
                {genderOption}
              </button>
            ))}
          </div>
        </div>

        {/* Village and Phone side-by-side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-2">Village</label>
            <input 
              type="text"
              value={newPatient.village}
              onChange={(e) => setNewPatient(prev => ({ ...prev, village: e.target.value }))}
              className="w-full min-h-[50px] px-4 rounded-xl border border-slate-200 focus:border-[#E07A5F] focus:outline-none text-slate-700 font-medium"
              placeholder="e.g. Rampur"
            />
          </div>
          <div>
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-2">Phone (Optional)</label>
            <input 
              type="tel"
              value={newPatient.phone}
              onChange={(e) => setNewPatient(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full min-h-[50px] px-4 rounded-xl border border-slate-200 focus:border-[#E07A5F] focus:outline-none text-slate-700 font-medium"
              placeholder="e.g. 9876543210"
            />
          </div>
        </div>

        {/* Notes (Optional) */}
        <div>
          <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-2">Notes (Optional)</label>
          <textarea 
            rows="3"
            value={newPatient.notes}
            onChange={(e) => setNewPatient(prev => ({ ...prev, notes: e.target.value }))}
            className="w-full p-4 rounded-xl border border-slate-200 focus:border-[#E07A5F] focus:outline-none text-slate-700 font-medium resize-none"
            placeholder="Any background info: pregnancy, chronic conditions, etc."
          ></textarea>
        </div>

        {/* Form Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button 
            type="submit"
            className="flex-grow min-h-[50px] px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-sm"
          >
            Save Patient Info
          </button>
          <button 
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            className="flex-grow min-h-[50px] px-5 bg-[#E07A5F] hover:bg-[#D46A4F] text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-soft transition-all text-sm hover:-translate-y-0.5 active:translate-y-0"
          >
            Save & start triage
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
