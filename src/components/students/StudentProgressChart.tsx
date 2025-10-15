import React from 'react';
import type { ProgressDataPoint } from '../../utils/studentAnalytics';
import { formatDate } from '../../utils/dateFormatter';

interface StudentProgressChartProps {
  data: ProgressDataPoint[];
}

export const StudentProgressChart: React.FC<StudentProgressChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="bg-gray-50 p-8 rounded-lg text-center">
        <p className="text-gray-600">Няма данни за визуализация</p>
      </div>
    );
  }

  // Calculate dimensions and scales
  const minGrade = 2;
  const maxGrade = 6;
  const gradeRange = maxGrade - minGrade;
  const chartHeight = 300;
  const chartPadding = { top: 20, right: 20, bottom: 60, left: 50 };
  const dataWidth = Math.max(600, data.length * 80);
  
  // Calculate average line
  const averageGrade = data.reduce((sum, d) => sum + d.grade, 0) / data.length;
  
  // Convert grade to Y position
  const gradeToY = (grade: number) => {
    const percentage = (grade - minGrade) / gradeRange;
    return chartHeight - chartPadding.bottom - (percentage * (chartHeight - chartPadding.top - chartPadding.bottom));
  };

  // Create path for line chart
  const createPath = () => {
    const points = data.map((point, index) => {
      const x = chartPadding.left + (index * ((dataWidth - chartPadding.left - chartPadding.right) / (data.length - 1)));
      const y = gradeToY(point.grade);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    });
    return points.join(' ');
  };

  // Average line Y position
  const avgY = gradeToY(averageGrade);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-4">Прогрес във времето</h4>
      
      <div className="overflow-x-auto">
        <svg width={dataWidth} height={chartHeight} className="w-full">
          {/* Grid lines */}
          {[6, 5, 4, 3, 2].map(grade => {
            const y = gradeToY(grade);
            return (
              <g key={grade}>
                <line
                  x1={chartPadding.left}
                  y1={y}
                  x2={dataWidth - chartPadding.right}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
                <text
                  x={chartPadding.left - 10}
                  y={y + 5}
                  textAnchor="end"
                  fontSize="12"
                  fill="#6b7280"
                >
                  {grade}
                </text>
              </g>
            );
          })}

          {/* Average line */}
          <line
            x1={chartPadding.left}
            y1={avgY}
            x2={dataWidth - chartPadding.right}
            y2={avgY}
            stroke="#9ca3af"
            strokeWidth="2"
            strokeDasharray="5,5"
            opacity="0.5"
          />
          <text
            x={dataWidth - chartPadding.right - 5}
            y={avgY - 5}
            textAnchor="end"
            fontSize="11"
            fill="#6b7280"
          >
            Среден: {averageGrade.toFixed(2)}
          </text>

          {/* Main line chart */}
          <path
            d={createPath()}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {data.map((point, index) => {
            const x = chartPadding.left + (index * ((dataWidth - chartPadding.left - chartPadding.right) / (data.length - 1)));
            const y = gradeToY(point.grade);
            
            // Color based on grade
            let color = '#ef4444'; // red
            if (point.grade >= 6.0) color = '#22c55e'; // green
            else if (point.grade >= 5.0) color = '#3b82f6'; // blue
            else if (point.grade >= 4.0) color = '#eab308'; // yellow
            else if (point.grade >= 3.0) color = '#f97316'; // orange

            return (
              <g key={index}>
                <circle
                  cx={x}
                  cy={y}
                  r="6"
                  fill={color}
                  stroke="white"
                  strokeWidth="2"
                />
                
                {/* X-axis labels (dates) */}
                <text
                  x={x}
                  y={chartHeight - chartPadding.bottom + 20}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#6b7280"
                  transform={`rotate(-45, ${x}, ${chartHeight - chartPadding.bottom + 20})`}
                >
                  {formatDate(point.date)}
                </text>
                
                {/* Grade labels */}
                <text
                  x={x}
                  y={y - 15}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="bold"
                  fill={color}
                >
                  {point.grade.toFixed(2)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span>Отличен (6)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            <span>Много добър (5)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
            <span>Добър (4)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-orange-500"></div>
            <span>Среден (3)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span>Слаб (2)</span>
          </div>
        </div>
      </div>
    </div>
  );
};


