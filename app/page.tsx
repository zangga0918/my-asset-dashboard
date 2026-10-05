'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Owner = '남편' | '아내' | '공통';
type InvestCategory = '해외직투' | '국내직투' | 'ISA' | '개인연금저축' | 'IRP' | '퇴직금';
type LoanCategory = '주택담보대출' | '사내대출' | '마이너스 통장' | '신용대출' | '기타대출';

interface StockAsset {
  id: string;
  owner: Owner;
  category: InvestCategory;
  name: string;
  ticker: string;
  currency: 'KRW' | 'USD';
  buyDate: string;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
}

interface ManualAsset {
  home: number;
  jeonse: number;
  deposit: number;
}

interface LoanAsset {
  id: string;
  owner: Owner;
  category: LoanCategory;
  name: string;
  amount: number;
  interestRate: number;
}

// 캡처 화면 13개 종목 및 전세금 4.4억 데이터 반영
const INITIAL_MANUAL_ASSETS: Record<Owner, ManualAsset> = {
  남편: { home: 0, jeonse: 440000000, deposit: 0 },
  아내: { home: 0, jeonse: 0, deposit: 0 },
  공통: { home: 0, jeonse: 0, deposit: 0 },
};

const INITIAL_STOCKS: StockAsset[] = [
  { id: '1', owner: '남편', category: '해외직투', name: '아이렌', ticker: 'IREN', currency: 'USD', buyDate: '2025-04-01', quantity: 1510, buyPrice: 12.1, currentPrice: 41.76 },
  { id: '2', owner: '남편', category: '해외직투', name: '로켓랩', ticker: 'RKLB', currency: 'USD', buyDate: '2025-04-05', quantity: 810, buyPrice: 30.2, currentPrice: 73.92 },
  { id: '3', owner: '남편', category: '해외직투', name: '테슬라', ticker: 'TSLA', currency: 'USD', buyDate: '2026-10-05', quantity: 55, buyPrice: 348, currentPrice: 370.59 },
  { id: '4', owner: '남편', category: '해외직투', name: '인플렉션', ticker: 'INFQ', currency: 'USD', buyDate: '2026-04-01', quantity: 1357, buyPrice: 15.1, currentPrice: 13.15 },
  { id: '5', owner: '남편', category: '해외직투', name: '아이온큐', ticker: 'IONQ', currency: 'USD', buyDate: '2026-04-05', quantity: 39, buyPrice: 55.5, currentPrice: 43.77 },
  { id: '6', owner: '남편', category: '해외직투', name: '플루언스에너지', ticker: 'FLNC', currency: 'USD', buyDate: '2026-10-05', quantity: 170, buyPrice: 14.1, currentPrice: 7.61 },
  { id: '7', owner: '남편', category: '국내직투', name: '하이닉스', ticker: '000660', currency: 'KRW', buyDate: '2026-10-05', quantity: 5, buyPrice: 1722000, currentPrice: 1841000 },
  { id: '8', owner: '남편', category: '해외직투', name: '삼성전자', ticker: '005930', currency: 'KRW', buyDate: '2026-10-05', quantity: 271, buyPrice: 271000, currentPrice: 276000 },
  { id: '9', owner: '남편', category: 'ISA', name: 'Kodex미국배당커버드콜액티브', ticker: '441640', currency: 'KRW', buyDate: '2026-10-05', quantity: 1251, buyPrice: 10321, currentPrice: 12120 },
  { id: '10', owner: '남편', category: '해외직투', name: '제이알글로벌리츠', ticker: '348950', currency: 'KRW', buyDate: '2026-10-05', quantity: 2527, buyPrice: 1320, currentPrice: 1182 },
  { id: '11', owner: '남편', category: '개인연금저축', name: 'ACE미국S&P500', ticker: '360200', currency: 'KRW', buyDate: '2026-10-05', quantity: 329, buyPrice: 20694, currentPrice: 26055 },
  { id: '12', owner: '남편', category: '개인연금저축', name: 'ACE미국나스닥100', ticker: '367380', currency: 'KRW', buyDate: '2026-10-05', quantity: 221, buyPrice: 22374, currentPrice: 31500 },
  { id: '13', owner: '남편', category: 'ISA', name: 'KODEX미국배당커버드콜액티브', ticker: '441640', currency: 'KRW', buyDate: '2026-10-05', quantity: 1609, buyPrice: 10812, currentPrice: 12120 },
];

function formatKoreanWon(val: number): string {
  if (!val || isNaN(val) || val <= 0) return '0원';
  const eok = Math.floor(val / 100000000);
  const man = Math.floor((val % 100000000) / 10000);
  let res = '';
  if (eok > 0) res += `${eok}억 `;
  if (man > 0) res += `${man}만`;
  return res.trim() + '원';
}

export default function AssetDashboard() {
  const [exchangeRate] = useState<number>(1420);
  const [selectedOwner] = useState<'전체' | Owner>('전체');
  const [expandedCategory, setExpandedCategory] = useState<InvestCategory | null>(null);

  const [manualAssets, setManualAssets] = useState<Record<Owner, ManualAsset>>(INITIAL_MANUAL_ASSETS);
  const [loanAssets, setLoanAssets] = useState<LoanAsset[]>([]);
  const [stockAssets, setStockAssets] = useState<StockAsset[]>(INITIAL_STOCKS);

  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  const [stockForm, setStockForm] = useState({
    owner: '남편' as Owner,
    category: '해외직투' as InvestCategory,
    name: '',
    ticker: '',
    currency: 'USD' as 'KRW' | 'USD',
    buyDate: new Date().toISOString().split('T')[0],
    quantity: '',
    buyPrice: '',
    currentPrice: '',
  });

  // Supabase 클라우드 동기화 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data } = await supabase
          .from('user_dashboard_data')
          .select('data')
          .eq('id', 'main_family_asset')
          .single();

        if (data && data.data && data.data.stocks && data.data.stocks.length > 0) {
          setStockAssets(data.data.stocks);
          if (data.data.manual) setManualAssets(data.data.manual);
          if (data.data.loans) setLoanAssets(data.data.loans);
        } else {
          await syncToSupabase(INITIAL_STOCKS, INITIAL_MANUAL_ASSETS, []);
        }
      } catch (err) {
        console.warn('Supabase 로드 대기 중 (기본값 유지):', err);
      }
    };
    loadData();
  }, []);

  const syncToSupabase = async (
    stocks: StockAsset[],
    manual: Record<Owner, ManualAsset>,
    loans: LoanAsset[]
  ) => {
    try {
      await supabase
        .from('user_dashboard_data')
        .upsert({
          id: 'main_family_asset',
          data: { stocks, manual, loans },
          updated_at: new Date().toISOString(),
        });
    } catch (e) {
      console.error('Supabase 연동 실패:', e);
    }
  };

  const handleUpdateStocks = (newStocks: StockAsset[]) => {
    setStockAssets(newStocks);
    syncToSupabase(newStocks, manualAssets, loanAssets);
  };

  const handleUpdateManual = (newManual: Record<Owner, ManualAsset>) => {
    setManualAssets(newManual);
    syncToSupabase(stockAssets, newManual, loanAssets);
  };

  const getAssetKRW = (item: StockAsset) => {
    const rate = item.currency === 'USD' ? exchangeRate : 1;
    const valKRW = item.quantity * item.currentPrice * rate;
    const costKRW = item.quantity * item.buyPrice * rate;
    const profitKRW = valKRW - costKRW;
    const roi = costKRW > 0 ? (profitKRW / costKRW) * 100 : 0;
    return { valKRW, costKRW, profitKRW, roi };
  };

  const getCategoryStats = (cat: InvestCategory) => {
    const filtered = stockAssets
      .filter((a) => (selectedOwner === '전체' ? true : a.owner === selectedOwner))
      .filter((a) => a.category === cat);

    let totalVal = 0;
    let totalCost = 0;

    filtered.forEach((item) => {
      const { valKRW, costKRW } = getAssetKRW(item);
      totalVal += valKRW;
      totalCost += costKRW;
    });

    const profit = totalVal - totalCost;
    const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    return { totalVal, totalCost, profit, roi, items: filtered };
  };

  const getManualTotal = (key: keyof ManualAsset) => {
    if (selectedOwner === '전체') {
      return manualAssets.남편[key] + manualAssets.아내[key] + manualAssets.공통[key];
    }
    return manualAssets[selectedOwner][key];
  };

  const jeonseVal = getManualTotal('jeonse');
  const overseasStats = getCategoryStats('해외직투');
  const domesticStats = getCategoryStats('국내직투');
  const isaStats = getCategoryStats('ISA');
  const liquidAssets = jeonseVal + overseasStats.totalVal + domesticStats.totalVal + isaStats.totalVal;

  const pensionStats = getCategoryStats('개인연금저축');
  const irpStats = getCategoryStats('IRP');
  const severanceStats = getCategoryStats('퇴직금');
  const retirementAssets = pensionStats.totalVal + irpStats.totalVal + severanceStats.totalVal;

  const totalLoanAmount = loanAssets.reduce((sum, l) => sum + l.amount, 0);
  const grandNetAssets = liquidAssets + retirementAssets - totalLoanAmount;

  const handleToggleCategory = (cat: InvestCategory) => {
    setExpandedCategory(expandedCategory === cat ? null : cat);
  };

  const handleAddStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockForm.name || !stockForm.quantity || !stockForm.buyPrice) return;

    const buyP = parseFloat(stockForm.buyPrice);
    const currP = stockForm.currentPrice ? parseFloat(stockForm.currentPrice) : buyP;

    const newItem: StockAsset = {
      id: Date.now().toString(),
      owner: stockForm.owner,
      category: stockForm.category,
      name: stockForm.name,
      ticker: stockForm.ticker.toUpperCase() || 'CUSTOM',
      currency: stockForm.currency,
      buyDate: stockForm.buyDate,
      quantity: parseFloat(stockForm.quantity),
      buyPrice: buyP,
      currentPrice: currP,
    };

    handleUpdateStocks([...stockAssets, newItem]);
    setIsStockModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#060b13] text-slate-100 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-5">
        
        {/* 상단 환율 & 버튼 영역 */}
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="text-slate-400 font-normal">기준 환율:</span>
            <span className="text-[#00e5a3]">₩{exchangeRate.toLocaleString()}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsManualModalOpen(true)}
              className="bg-[#121c2d] hover:bg-[#1a2942] text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700/60 transition flex items-center gap-1"
            >
              ⚙ 자가·전세·예금
            </button>
            <button
              onClick={() => setIsStockModalOpen(true)}
              className="bg-[#1d64ec] hover:bg-[#1553c7] text-white px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1"
            >
              + 투자 종목 기입
            </button>
          </div>
        </div>

        {/* 1. 최상단 순자산 카드 */}
        <div className="bg-[#0b1322] border border-slate-800/80 p-7 rounded-2xl">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] text-blue-400 font-semibold tracking-wider">
                [{selectedOwner}] 기준 총 순자산 (자산 - 대출)
              </span>
              <div className="text-4xl md:text-5xl font-black text-white mt-1">
                ₩ {Math.round(grandNetAssets).toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                ({formatKoreanWon(grandNetAssets)})
              </p>
            </div>

            <div className="flex gap-8 text-left">
              <div>
                <p className="text-[11px] text-slate-400">가용 자산</p>
                <p className="text-sm font-bold text-[#00e5a3] mt-0.5">
                  ₩ {Math.round(liquidAssets).toLocaleString()}
                </p>
                <span className="text-[10px] text-slate-500">{formatKoreanWon(liquidAssets)}</span>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">노후 자금</p>
                <p className="text-sm font-bold text-[#f59e0b] mt-0.5">
                  ₩ {Math.round(retirementAssets).toLocaleString()}
                </p>
                <span className="text-[10px] text-slate-500">{formatKoreanWon(retirementAssets)}</span>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">총 대출</p>
                <p className="text-sm font-bold text-rose-500 mt-0.5">-₩0</p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. 자산 3대 영역 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* 가용 가능한 금액 */}
          <div className="bg-[#0b1322] border border-slate-800/80 rounded-2xl p-5">
            <div className="flex justify-between items-center pb-4">
              <span className="text-xs font-bold text-slate-200">가용 가능한 금액</span>
              <span className="text-xs font-bold text-[#00e5a3]">{formatKoreanWon(liquidAssets)}</span>
            </div>
            <div className="grid grid-cols-2 gap-y-4 text-xs">
              <div>
                <span className="text-[10px] text-slate-500">전세금</span>
                <p className="font-bold text-white mt-0.5">₩{Math.round(jeonseVal).toLocaleString()}</p>
                <p className="text-[10px] text-slate-500">{formatKoreanWon(jeonseVal)}</p>
              </div>
              <div onClick={() => handleToggleCategory('해외직투')} className="cursor-pointer hover:opacity-80 transition">
                <span className="text-[10px] text-blue-400 font-medium">해외직투 ▾</span>
                <p className="font-bold text-white mt-0.5">₩{Math.round(overseasStats.totalVal).toLocaleString()}</p>
              </div>
              <div onClick={() => handleToggleCategory('국내직투')} className="cursor-pointer hover:opacity-80 transition">
                <span className="text-[10px] text-blue-400 font-medium">국내직투 ▾</span>
                <p className="font-bold text-white mt-0.5">₩{Math.round(domesticStats.totalVal).toLocaleString()}</p>
              </div>
              <div onClick={() => handleToggleCategory('ISA')} className="cursor-pointer hover:opacity-80 transition">
                <span className="text-[10px] text-blue-400 font-medium">ISA ▾</span>
                <p className="font-bold text-white mt-0.5">₩{Math.round(isaStats.totalVal).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* 노후 자금 (개인연금저축 / IRP / 퇴직금) */}
          <div className="bg-[#0b1322] border border-slate-800/80 rounded-2xl p-5">
            <div className="flex justify-between items-center pb-4">
              <span className="text-xs font-bold text-slate-200">노후 자금</span>
              <span className="text-xs font-bold text-[#f59e0b]">{formatKoreanWon(retirementAssets)}</span>
            </div>
            <div className="space-y-3 text-xs">
              <div onClick={() => handleToggleCategory('개인연금저축')} className="cursor-pointer hover:opacity-80 transition flex justify-between items-center">
                <span className="text-[10px] text-[#f59e0b] font-medium">개인연금저축 ▾</span>
                <p className="font-bold text-white">₩{Math.round(pensionStats.totalVal).toLocaleString()}</p>
              </div>
              <div onClick={() => handleToggleCategory('IRP')} className="cursor-pointer hover:opacity-80 transition flex justify-between items-center">
                <span className="text-[10px] text-[#f59e0b] font-medium">IRP ▾</span>
                <p className="font-bold text-white">₩{Math.round(irpStats.totalVal).toLocaleString()}</p>
              </div>
              <div onClick={() => handleToggleCategory('퇴직금')} className="cursor-pointer hover:opacity-80 transition flex justify-between items-center">
                <span className="text-[10px] text-[#f59e0b] font-medium">퇴직금 ▾</span>
                <p className="font-bold text-white">₩{Math.round(severanceStats.totalVal).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* 대출 현황 */}
          <div className="bg-[#0b1322] border border-slate-800/80 rounded-2xl p-5">
            <div className="flex justify-between items-center pb-4">
              <span className="text-xs font-bold text-slate-200">대출 현황</span>
              <span className="text-xs font-bold text-rose-500">0원</span>
            </div>
            <p className="text-xs text-slate-600 text-center py-6">등록된 대출이 없습니다.</p>
          </div>

        </div>

        {/* 3. 카테고리 클릭 시 열리는 세부 보유 종목 영역 */}
        {expandedCategory && (
          <div className="bg-[#0b1322] border border-blue-500/50 rounded-2xl p-5 transition-all">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800/80">
              <h3 className="text-xs font-bold text-blue-400">
                📂 {expandedCategory} 세부 보유 종목
              </h3>
              <button
                onClick={() => setExpandedCategory(null)}
                className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800/80"
              >
                닫기 ✕
              </button>
            </div>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] text-slate-500 border-b border-slate-800/80 bg-[#080e18]">
                  <tr>
                    <th className="py-2 px-3">종목(티커)</th>
                    <th className="py-2 px-3">매입일자</th>
                    <th className="py-2 px-3">수량</th>
                    <th className="py-2 px-3">매입단가</th>
                    <th className="py-2 px-3">현재가</th>
                    <th className="py-2 px-3">원화 평가액</th>
                    <th className="py-2 px-3">수익률</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {getCategoryStats(expandedCategory).items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-slate-600">등록된 종목이 없습니다.</td>
                    </tr>
                  ) : (
                    getCategoryStats(expandedCategory).items.map((item) => {
                      const { valKRW, roi } = getAssetKRW(item);
                      const isProfit = roi >= 0;
                      return (
                        <tr key={item.id} className="hover:bg-slate-800/20">
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-white block">{item.name}</span>
                            <span className="text-[10px] text-slate-500">{item.ticker}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{item.buyDate}</td>
                          <td className="py-2.5 px-3 text-slate-200">{item.quantity.toLocaleString()}</td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {item.currency === 'USD' ? `$${item.buyPrice}` : `₩${item.buyPrice.toLocaleString()}`}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-[#00e5a3]">
                            {item.currency === 'USD' ? `$${item.currentPrice}` : `₩${item.currentPrice.toLocaleString()}`}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-white">₩{Math.round(valKRW).toLocaleString()}</td>
                          <td className="py-2.5 px-3">
                            <span className={`font-semibold ${isProfit ? 'text-rose-500' : 'text-blue-400'}`}>
                              {isProfit ? '+' : ''}{roi.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. 전체 보유 투자 종목 리스트 테이블 (13개 종목) */}
        <div className="bg-[#0b1322] border border-slate-800/80 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800/80">
            <h2 className="text-xs font-bold text-slate-200">
              보유 투자 종목 리스트 ({stockAssets.length}개)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] text-slate-500 border-b border-slate-800/80 bg-[#080e18]">
                <tr>
                  <th className="py-2.5 px-3">소유자</th>
                  <th className="py-2.5 px-3">분류</th>
                  <th className="py-2.5 px-3">종목(티커)</th>
                  <th className="py-2.5 px-3">매입일자</th>
                  <th className="py-2.5 px-3">수량</th>
                  <th className="py-2.5 px-3">매입단가</th>
                  <th className="py-2.5 px-3">현재가</th>
                  <th className="py-2.5 px-3">원화 평가액</th>
                  <th className="py-2.5 px-3">수익률</th>
                  <th className="py-2.5 px-3 text-center">삭제</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {stockAssets.map((item) => {
                  const { valKRW, roi } = getAssetKRW(item);
                  const isProfit = roi >= 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/20 transition">
                      <td className="py-3 px-3 text-slate-300">{item.owner}</td>
                      <td className="py-3 px-3 text-slate-300">{item.category}</td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-white block">{item.name}</span>
                        <span className="text-[10px] text-slate-500">{item.ticker}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-500">{item.buyDate}</td>
                      <td className="py-3 px-3 text-slate-200">{item.quantity.toLocaleString()}</td>
                      <td className="py-3 px-3 text-slate-400">
                        {item.currency === 'USD' ? `$${item.buyPrice}` : `₩${item.buyPrice.toLocaleString()}`}
                      </td>
                      <td className="py-3 px-3 font-semibold text-[#00e5a3]">
                        {item.currency === 'USD' ? `$${item.currentPrice}` : `₩${item.currentPrice.toLocaleString()}`}
                      </td>
                      <td className="py-3 px-3 font-bold text-white">
                        ₩ {Math.round(valKRW).toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`font-semibold ${isProfit ? 'text-rose-500' : 'text-blue-400'}`}>
                          {isProfit ? '+' : ''}{roi.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleUpdateStocks(stockAssets.filter((s) => s.id !== item.id))}
                          className="text-slate-600 hover:text-rose-400 text-xs transition"
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
        </div>

        {/* 모달: 자가·전세·예금 설정 */}
        {isManualModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[#0b1322] border border-slate-700 w-full max-w-sm p-5 rounded-2xl shadow-xl">
              <h3 className="text-sm font-bold text-white mb-3">전세금 설정</h3>
              <div>
                <label className="text-[11px] text-slate-400">남편 전세금 (원)</label>
                <input
                  type="number"
                  value={manualAssets.남편.jeonse}
                  onChange={(e) => handleUpdateManual({
                    ...manualAssets,
                    남편: { ...manualAssets.남편, jeonse: Number(e.target.value) }
                  })}
                  className="w-full bg-[#060b13] border border-slate-700 rounded-lg p-2 text-xs text-white mt-1"
                />
              </div>
              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-3 py-1.5 bg-[#1d64ec] rounded-lg text-xs font-bold text-white"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 모달: 종목 추가 */}
        {isStockModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[#0b1322] border border-slate-700 w-full max-w-sm p-5 rounded-2xl shadow-xl">
              <h3 className="text-sm font-bold text-white mb-3">투자 종목 추가</h3>
              <form onSubmit={handleAddStock} className="space-y-2 text-xs">
                <div>
                  <label className="text-slate-400">계좌 분류</label>
                  <select
                    value={stockForm.category}
                    onChange={(e) => {
                      const cat = e.target.value as InvestCategory;
                      setStockForm({
                        ...stockForm,
                        category: cat,
                        currency: cat === '해외직투' ? 'USD' : 'KRW',
                      });
                    }}
                    className="w-full bg-[#060b13] border border-slate-700 rounded-lg p-2 text-white mt-0.5"
                  >
                    <option value="해외직투">해외직투</option>
                    <option value="국내직투">국내직투</option>
                    <option value="ISA">ISA</option>
                    <option value="개인연금저축">개인연금저축</option>
                    <option value="IRP">IRP</option>
                    <option value="퇴직금">퇴직금</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400">종목명</label>
                  <input
                    type="text"
                    required
                    value={stockForm.name}
                    onChange={(e) => setStockForm({ ...stockForm, name: e.target.value })}
                    className="w-full bg-[#060b13] border border-slate-700 rounded-lg p-2 text-white mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-slate-400">티커</label>
                  <input
                    type="text"
                    required
                    value={stockForm.ticker}
                    onChange={(e) => setStockForm({ ...stockForm, ticker: e.target.value })}
                    className="w-full bg-[#060b13] border border-slate-700 rounded-lg p-2 text-white mt-0.5 uppercase"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-400">수량</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={stockForm.quantity}
                      onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                      className="w-full bg-[#060b13] border border-slate-700 rounded-lg p-2 text-white mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400">매입단가</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={stockForm.buyPrice}
                      onChange={(e) => setStockForm({ ...stockForm, buyPrice: e.target.value })}
                      className="w-full bg-[#060b13] border border-slate-700 rounded-lg p-2 text-white mt-0.5"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsStockModalOpen(false)}
                    className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-[#1d64ec] font-bold text-white rounded-lg"
                  >
                    저장
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