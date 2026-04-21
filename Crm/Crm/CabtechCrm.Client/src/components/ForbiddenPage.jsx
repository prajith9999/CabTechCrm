import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

const ForbiddenPage = ({
  onBack,
  title = 'Access Denied',
  message = "You don't have the necessary permissions to access this module. Please contact your system administrator if you believe this is a mistake."
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white rounded-none shadow-sm border border-slate-100">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-20 h-20 bg-red-50 text-red-500 rounded-none flex items-center justify-center mb-6"
      >
        <ShieldAlert size={40} />
      </motion.div>

      <h2 className="text-3xl font-bold text-slate-900 mb-2">{title}</h2>
      <p className="text-slate-500 max-w-md mb-8">
        {message}
      </p>

      <button
        onClick={onBack}
        className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-none font-semibold hover:bg-slate-800 transition-all shadow-lg"
      >
        <ArrowLeft size={18} />
        Return to Dashboard
      </button>
    </div>
  );
};

export default ForbiddenPage;
