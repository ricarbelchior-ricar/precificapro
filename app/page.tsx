'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function PrecificaProDashboard() {
  const searchParams = useSearchParams();
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    if (searchParams.get('unlocked') === 'true') {
      setIsUnlocked(true);
      localStorage.setItem('precificapro_unlocked', 'true');
    } else if (localStorage.getItem('precificapro_unlocked') === 'true') {
      setIsUnlocked(true);
    }
  }, [searchParams]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">PrecificaPro - Análise Financeira</h1>
      
      {isUnlocked ? (
        <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
          <h2 className="text-xl font-semibold text-green-800">Relatório Premium Desbloqueado!</h2>
          <p className="text-green-700 mt-2">Aceda abaixo aos dados completos de precificação e margens.</p>
        </div>
      ) : (
        <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <h2 className="text-xl font-semibold mb-2">Obtenha o Relatório Completo</h2>
          <p className="text-gray-600 mb-4">Desbloqueie o acesso total por apenas €9,99.</p>
          <a
            href="https://buy.stripe.com/fZu00i6jVaHD26W1gB4ow00"
            className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition"
          >
            Comprar Acesso (€9,99)
          </a>
        </div>
      )}
    </div>
  );
}
