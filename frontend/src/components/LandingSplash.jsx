import React, { useState, useEffect } from 'react';
import { X, Quote } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const ASHA_QUOTES = [
  {
    en: "ASHA workers are the heartbeat of rural healthcare — bringing care, healing, and hope to every doorstep.",
    hi: "आशा कार्यकर्ता ग्रामीण स्वास्थ्य सेवा की धड़कन हैं — हर घर तक स्वास्थ्य, देखभाल और उम्मीद पहुंचाती हैं।",
    mr: "आशा सेविका ग्रामीण आरोग्य सेवेचे हृदय आहेत — प्रत्येक घरापर्यंत उपचार, काळजी आणि आशा पोहोचवतात."
  },
  {
    en: "Every household visited by an ASHA worker strengthens public health, maternal safety, and village wellness.",
    hi: "आशा कार्यकर्ता द्वारा दौरा किया गया हर परिवार जन स्वास्थ्य, मातृ सुरक्षा और ग्रामीण कल्याण को मजबूत करता है।",
    mr: "आशा सेविकेने भेट दिलेले प्रत्येक कुटुंब सार्वजनिक आरोग्य, माता सुरक्षा आणि गावाचे कल्याण मजबूत करते."
  },
  {
    en: "Standing strong on the frontlines: Saluting the dedication of Accredited Social Health Activists across India.",
    hi: "स्वास्थ्य सेवा की अग्रिम पंक्ति में समर्पित: भारत भर की आशा कार्यकर्ताओं के निष्ठावान कार्य को प्रणाम।",
    mr: "आरोग्य सेवेच्या आघाडीवर कार्यतत्पर: संपूर्ण भारतातील आशा सेविकांच्या निष्ठावान कार्याला सलाम."
  },
  {
    en: "Behind every healthy mother and newborn in rural India lies the tireless commitment of an ASHA worker.",
    hi: "ग्रामीण भारत में हर स्वस्थ मां और नवजात के पीछे एक आशा कार्यकर्ता का अनथक समर्पण होता है।",
    mr: "ग्रामीण भारतातील प्रत्येक निरोगी माता आणि बाळाच्या मागे आशा सेविकेचे अथांग कार्य असते."
  },
  {
    en: "Accredited Social Health Activists — Essential partners in building healthier communities, one village at a time.",
    hi: "आशा कार्यकर्ता — हर गांव को स्वस्थ और सशक्त बनाने में समाज की सबसे महत्वपूर्ण कड़ी।",
    mr: "आशा सेविका — प्रत्येक गाव निरोगी बनवणारा समाजोपयोगी महत्त्वाचा दुवा."
  }
];

export default function LandingSplash({ onComplete }) {
  const { language } = useLanguage();
  const lang = ['en', 'hi', 'mr'].includes(language) ? language : 'en';

  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Pick random quote on mount
  const [quote] = useState(() => {
    const idx = Math.floor(Math.random() * ASHA_QUOTES.length);
    return ASHA_QUOTES[idx];
  });

  useEffect(() => {
    // 2 Seconds timer
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 1700);

    const closeTimer = setTimeout(() => {
      setIsVisible(false);
      if (onComplete) onComplete();
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [onComplete]);

  const handleSkip = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      if (onComplete) onComplete();
    }, 150);
  };

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-lg text-white p-6 transition-all duration-300 ease-out ${
        isFadingOut ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* 2-Second Top Progress Line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 overflow-hidden">
        <div 
          className="h-full bg-[#E07A5F]"
          style={{
            animation: 'splashProgress 2s linear forwards'
          }}
        />
      </div>

      {/* Skip button */}
      <button 
        onClick={handleSkip}
        className="absolute top-6 right-6 text-xs bg-white/10 hover:bg-white/20 border border-white/20 text-white/90 px-3.5 py-1.5 rounded-full font-medium flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
      >
        <span>Skip</span>
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Minimalist Quote Box */}
      <div className="max-w-2xl text-center space-y-4 px-4">
        <Quote className="w-8 h-8 text-[#E07A5F] mx-auto opacity-80" />
        
        <blockquote className="text-lg md:text-2xl font-light text-slate-100 leading-relaxed tracking-wide">
          "{quote[lang] || quote.en}"
        </blockquote>

        <p className="text-xs uppercase tracking-widest text-[#E07A5F] font-semibold pt-2">
          — Accredited Social Health Activists (ASHA)
        </p>
      </div>

      <style>{`
        @keyframes splashProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
