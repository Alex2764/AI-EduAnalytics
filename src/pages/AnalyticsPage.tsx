import React from 'react';

export const AnalyticsPage: React.FC = () => {
  return (
    <div className="card text-center">
      <div className="space-y-6">
        {/* Main Heading */}
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-gray-800">
            Ще има подобрения с AI
          </h2>
          <p className="text-base text-gray-600">
            Очаквайте скоро
          </p>
        </div>
        
        {/* Features Section - Clean */}
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
          <h3 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-300">
            В разработка
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
            <div className="space-y-2">
              <div className="p-3 bg-white rounded-lg border border-gray-200">
                <span className="text-sm text-gray-800">Прикачване на тестовете и анализ от AI</span>
              </div>
              
              <div className="p-3 bg-white rounded-lg border border-gray-200">
                <span className="text-sm text-gray-800">Даване на препоръки за пропуските от учениците</span>
              </div>
              
              <div className="p-3 bg-white rounded-lg border border-gray-200">
                <span className="text-sm text-gray-800">Мотивация</span>
              </div>
              
              <div className="p-3 bg-white rounded-lg border border-gray-200">
                <span className="text-sm text-gray-800">Интелигентен анализ на успеваемостта</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="p-3 bg-white rounded-lg border border-gray-200">
                <span className="text-sm text-gray-800">AI препоръки за подобряване на резултатите</span>
              </div>
              
              <div className="p-3 bg-white rounded-lg border border-gray-200">
                <span className="text-sm text-gray-800">Автоматично генериране на отчети</span>
              </div>
              
              <div className="p-3 bg-white rounded-lg border border-gray-200">
                <span className="text-sm text-gray-800">Предсказване на рискове в обучението</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Status Badge - Clean */}
        <div className="mt-4">
          <div className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
            Функционалността се разработва активно
          </div>
        </div>
      </div>
    </div>
  );
};
