'use client';

import React, { useState, useEffect } from 'react';

// 자산 데이터 인터페이스 정의
interface Asset {
  id: string;
  ticker: string;
  name: string;
  currency: 'KRW' | 'USD';
  quantity: number;
  buyPrice: number;
  currentPrice: number;
}

export default function AssetDashboard() {
  // 실시간 환율 (기본값 세팅)
  const [exchangeRate, setExchangeRate] = useState<number>(1420);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // 1. 보유 종목 초기 데이터 (포트폴리오 기반)
  const [assets, setAssets] = useState<Asset[]>([
    { id: '1', ticker: 'RKLB', name: '로켓랩', currency: 'USD', quantity: 810, buyPrice: 34.86, currentPrice: 42.50 },
    { id: '2', ticker: 'IREN', name: '아이렌', currency: 'USD', quantity: 1510, buyPrice: 13.87, currentPrice: 16.20 },
    { id: '3', ticker: 'TSLA', name: '테슬라', currency: 'USD', quantity: 55, buyPrice: 349.46, currentPrice: 380.00 },
    { id: '4', ticker: 'FLNC', name: '플루언스에너지', currency: 'USD', quantity: 586, buyPrice: 20.46, currentPrice: 22.10 },
    { id: '5', ticker: 'INFLEX', name: '인플렉션', currency: 'USD', quantity: 896, buyPrice: 13.48, currentPrice: 13.48 },
    { id: '6', ticker: 'CIRCLE', name: '써클 인터내셔널', currency: 'USD', quantity: 136, buyPrice: 88.76, currentPrice: 88.76 },
    { id: '7', ticker: 'IONQ', name: '아이온큐', currency: 'USD', quantity: 39, buyPrice: 55.50, currentPrice: 62.00 },
    { id: '8', ticker: '005930.KS', name: '삼성전자', currency: 'KRW', quantity: 47, buyPrice: 171000, currentPrice: 185000 },
  ]);

  // 모달(종목 추가/수정창) 제어 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    ticker: '',
    name: '',
    currency: 'USD' as 'KRW' | 'USD',
    quantity: '',
    buyPrice: '',
    currentPrice: '',
  });

  // 로컬 스토리지 연동 (브라우저 새로고침 시에도 유지)
  useEffect(() => {
    const savedAssets = localStorage.getItem('user_portfolio_assets');
    if (savedAssets) {
      try {
        setAssets(JSON.parse(savedAssets));
      } catch (e) {
        console.error('기존 데이터 불러오기 실패', e);
      }
    }
    setLastUpdated(new Date().toLocaleTimeString());
  }, []);

  const saveAssets = (newAssets: Asset[]) => {
    setAssets(newAssets);
    localStorage.setItem('user_portfolio_assets', JSON.stringify(newAssets));
  };

  // 통계 계산
  let totalInvestedKRW = 0;
  let totalCurrentValuationKRW = 0;

  assets.forEach((asset) => {
    const rate = asset.currency === 'USD' ? exchangeRate : 1;
    totalInvestedKRW += asset.quantity * asset.buyPrice * rate;
    totalCurrentValuationKRW += asset.quantity * asset.currentPrice * rate;
  });

  const totalProfitKRW = totalCurrentValuationKRW - totalInvestedKRW;
  const totalReturnRate = totalInvestedKRW > 0 ? (totalProfitKRW / totalInvestedKRW) * 100 : 0;

  // 종목 추가 핸들러
  const handleAddAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.quantity || !formData.buyPrice) return;

    const newAsset: Asset = {
      id: Date.now().toString(),
      ticker: formData.ticker.toUpperCase() || 'CUSTOM',
      name: formData.name,
      currency: formData.currency,
      quantity: parseFloat(formData.quantity),
      buyPrice: parseFloat(formData.buyPrice),
      currentPrice: formData.currentPrice ? parseFloat(formData.currentPrice) : parseFloat(formData.buyPrice),
    };

    saveAssets([...assets, newAsset]);
    setFormData({ ticker: '', name: '', currency: 'USD', quantity: '', buyPrice: '', currentPrice: '' });
    setIsModalOpen(false);
  };

  // 종목 삭제 핸들러
  const handleDelete = (id: string) => {
    if (confirm('해당 종목을 삭제하시겠습니까?')) {
      saveAssets(assets.filter((a) => a.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* 상단 네비게이션 & 헤더 */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-800 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              📊 통합 자산관리 대시보드
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              실시간 평가 및 포트폴리오 관리 (기준 시간: {lastUpdated || '동기화 중...'})
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-lg text-sm transition shadow-lg shadow-blue-900/30"
            >
              + 종목 추가/기입
            </button>
          </div>
        </header>

        {/* 1. 상단 핵심 요약 지표 카드 */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <span className="text-xs font-semibold text-slate-400">총 평가 자산 (원화)</span>
            <div className="text-2xl md:text-3xl font-black text-white mt-1">
              ₩ {Math.round(totalCurrentValuationKRW).toLocaleString()}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <span className="text-xs font-semibold text-slate-400">총 평가 손익</span>
            <div className={`text-2xl md:text-3xl font-black mt-1 ${totalProfitKRW >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
              {totalProfitKRW >= 0 ? '+' : ''}₩ {Math.round(totalProfitKRW).toLocaleString()}
              <span className="text-sm font-semibold ml-2">({totalReturnRate >= 0 ? '+' : ''}{totalReturnRate.toFixed(2)}%)</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <span className="text-xs font-semibold text-slate-400">원화 환산 매수 원금</span>
            <div className="text-2xl md:text-3xl font-black text-slate-300 mt-1">
              ₩ {Math.round(totalInvestedKRW).toLocaleString()}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <span className="text-xs font-semibold text-slate-400">적용 환율 (USD/KRW)</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl md:text-2xl font-black text-emerald-400">₩</span>
              <input
                type="number"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(Number(e.target.value))}
                className="bg-slate-800 text-emerald-400 text-xl md:text-2xl font-black rounded px-2 py-0.5 w-28 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </section>

        {/* 2. 보유 종목 리스트 테이블 */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-200">보유 종목 현황</h2>
            <span className="text-xs text-slate-500">총 {assets.length}개 종목</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase font-medium border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">종목 (티커)</th>
                  <th className="py-3 px-4">수량</th>
                  <th className="py-3 px-4">매수가</th>
                  <th className="py-3 px-4">현재가</th>
                  <th className="py-3 px-4">평가액 (원화)</th>
                  <th className="py-3 px-4">수익률</th>
                  <th className="py-3 px-4 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {assets.map((asset) => {
                  const rate = asset.currency === 'USD' ? exchangeRate : 1;
                  const itemValuationKRW = asset.quantity * asset.currentPrice * rate;
                  const itemCostKRW = asset.quantity * asset.buyPrice * rate;
                  const itemProfitKRW = itemValuationKRW - itemCostKRW;
                  const itemReturnRate = itemCostKRW > 0 ? (itemProfitKRW / itemCostKRW) * 100 : 0;
                  const isProfit = itemProfitKRW >= 0;

                  return (
                    <tr key={asset.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-semibold text-white">
                        {asset.name}
                        <span className="block text-xs font-normal text-slate-400">{asset.ticker}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{asset.quantity.toLocaleString()}</td>
                      <td className="py-3 px-4 text-slate-400">
                        {asset.currency === 'USD' ? `$${asset.buyPrice.toLocaleString()}` : `₩${asset.buyPrice.toLocaleString()}`}
                      </td>
                      <td className="py-3 px-4 text-slate-200 font-medium">
                        {asset.currency === 'USD' ? `$${asset.currentPrice.toLocaleString()}` : `₩${asset.currentPrice.toLocaleString()}`}
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        ₩ {Math.round(itemValuationKRW).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${isProfit ? 'bg-red-950/60 text-red-400 border border-red-900/50' : 'bg-blue-950/60 text-blue-400 border border-blue-900/50'}`}>
                          {isProfit ? '+' : ''}{itemReturnRate.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDelete(asset.id)}
                          className="text-xs text-slate-500 hover:text-red-400 transition"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. 모달 레이어 (종목 추가/수정창) */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-md p-6 rounded-2xl shadow-2xl">
              <h3 className="text-xl font-bold mb-4 text-white">종목 매수/내역 기입</h3>
              <form onSubmit={handleAddAsset} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">종목명</label>
                  <input
                    type="text"
                    required
                    placeholder="예: 로켓랩, 테슬라"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">티커(심볼)</label>
                  <input
                    type="text"
                    placeholder="예: RKLB, TSLA, 005930.KS"
                    value={formData.ticker}
                    onChange={(e) => setFormData({ ...formData, ticker: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">통화</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value as 'KRW' | 'USD' })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="KRW">KRW (₩)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">보유 수량</label>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="수량 입력"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">매수가 (평단가)</label>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="단가 입력"
                      value={formData.buyPrice}
                      onChange={(e) => setFormData({ ...formData, buyPrice: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">현재가 (선택)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="미입력 시 매수가"
                      value={formData.currentPrice}
                      onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold text-white"
                  >
                    저장하기
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}