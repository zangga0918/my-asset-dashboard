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

// 캡처 화면 100% 실데이터 강제 기본값 세팅
const DEFAULT_MANUAL: Record<Owner, ManualAsset> = {
  남편: { home: 0, jeonse: 440000000, deposit: 0 },
  아내: { home: 0, jeonse: 0, deposit: 0 },
  공통: { home: 0, jeonse: 0, deposit: 0 },
};

const DEFAULT_STOCKS: StockAsset[] = [
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
  const rest = Math.floor(val % 10000);
  let res = '';
  if (eok > 0) res += `${eok}억 `;
  if (man > 0) res += `${man}만 `;
  if (rest > 0 && eok === 0 && man === 0) res += `${rest}`;
  return res.trim() + '원';
}

export default function AssetDashboard() {
  const [exchangeRate, setExchangeRate] = useState<number>(1420);
  const [rateLoading, setRateLoading] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string>('초기화 완료');

  const [selectedOwner, setSelectedOwner] = useState<'전체' | Owner>('전체');
  const [expandedCategory, setExpandedCategory] = useState<InvestCategory | null>(null);

  // 기본값을 화면 사진 데이터로 즉시 띄움 (빈 화면 원천 차단)
  const [manualAssets, setManualAssets] = useState<Record<Owner, ManualAsset>>(DEFAULT_MANUAL);
  const [loanAssets, setLoanAssets] = useState<LoanAsset[]>([]);
  const [stockAssets, setStockAssets] = useState<StockAsset[]>(DEFAULT_STOCKS);

  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);

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

  const [loanForm, setLoanForm] = useState({
    owner: '남편' as Owner,
    category: '주택담보대출' as LoanCategory,
    name: '',
    amount: '',
    interestRate: '',
  });

  // DB 저장 함수
  const saveToCloud = async (stocks: StockAsset[], manual: Record<Owner, ManualAsset>, loans: LoanAsset[]) => {
    localStorage.setItem('my_assets_stocks', JSON.stringify(stocks));
    localStorage.setItem('my_assets_manual', JSON.stringify(manual));
    localStorage.setItem('my_assets_loans', JSON.stringify(loans));

    try {
      setSyncStatus('클라우드 동기화 중...');
      const payload = { stocks, manual, loans };
      const { error } = await supabase
        .from('user_dashboard_data')
        .upsert({ id: 'main_family_asset', data: payload, updated_at: new Date().toISOString() });

      if (!error) {
        setSyncStatus('☁️ 실시간 동기화 완료');
      } else {
        setSyncStatus('로컬 저장 완료');
      }
    } catch {
      setSyncStatus('로컬 저장 완료');
    }
  };

  // 초기 로드: DB에 1개 이상의 데이터가 있으면 가져오고, 없거나 비어있으면 사진 데이터로 DB를 덮어씀
  useEffect(() => {
    const initData = async () => {
      try {
        const { data } = await supabase
          .from('user_dashboard_data')
          .select('data')
          .eq('id', 'main_family_asset')
          .single();

        if (data?.data?.stocks && data.data.stocks.length > 0) {
          setStockAssets(data.data.stocks);
          if (data.data.manual) setManualAssets(data.data.manual);
          if (data.data.loans) setLoanAssets(data.data.loans);
          setSyncStatus('☁️ DB 데이터 로드 완료');
        } else {
          // DB가 비어있으면 사진 기본값을 DB에 강제 저장
          await saveToCloud(DEFAULT_STOCKS, DEFAULT_MANUAL, []);
          setSyncStatus('☁️ 사진 데이터 DB 등록 완료');
        }
      } catch {
        // 네트워크 에러 시에도 무조건 사진 데이터 유지
        setSyncStatus('로컬 데이터 로드 완료');
      }
    };

    initData();
  }, []);

  // 사진 데이터로 즉시 강제 원복하는 비상 버튼
  const forceResetToPhotoData = () => {
    if (confirm('사진 속 자산 데이터(13개 종목, 전세금 4.4억)로 완전히 초기화하시겠습니까?')) {
      setStockAssets(DEFAULT_STOCKS);
      setManualAssets(DEFAULT_MANUAL);
      setLoanAssets([]);
      saveToCloud(DEFAULT_STOCKS, DEFAULT_MANUAL, []);
    }
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
    let totalUSDVal = 0;

    filtered.forEach((item) => {
      const { valKRW, costKRW } = getAssetKRW(item);
      totalVal += valKRW;
      totalCost += costKRW;
      if (item.currency === 'USD') totalUSDVal += item.quantity * item.currentPrice;
    });

    const profit = totalVal - totalCost;
    const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    return { totalVal, totalCost, profit, roi, totalUSDVal, count: filtered.length, items: filtered };
  };

  const getManualTotal = (key: keyof ManualAsset) => {
    if (selectedOwner === '전체') {
      return manualAssets.남편[key] + manualAssets.아내[key] + manualAssets.공통[key];
    }
    return manualAssets[selectedOwner][key];
  };

  const homeVal = getManualTotal('home');
  const jeonseVal = getManualTotal('jeonse');
  const depositVal = getManualTotal('deposit');
  const overseasStats = getCategoryStats('해외직투');
  const domesticStats = getCategoryStats('국내직투');
  const isaStats = getCategoryStats('ISA');
  const liquidAssets = homeVal + jeonseVal + depositVal + overseasStats.totalVal + domesticStats.totalVal + isaStats.totalVal;

  const pensionStats = getCategoryStats('개인연금저축');
  const irpStats = getCategoryStats('IRP');
  const severanceStats = getCategoryStats('퇴직금');
  const retirementAssets = pensionStats.totalVal + irpStats.totalVal + severanceStats.totalVal;

  const filteredLoans = loanAssets.filter((l) => (selectedOwner === '전체' ? true : l.owner === selectedOwner));
  const totalLoanAmount = filteredLoans.reduce((sum, l) => sum + l.amount, 0);
  const totalMonthlyInterest = filteredLoans.reduce((sum, l) => sum + (l.amount * (l.interestRate / 100)) / 12, 0);

  const grandNetAssets = (liquidAssets + retirementAssets) - totalLoanAmount;

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

    const nextStocks = [...stockAssets, newItem];
    setStockAssets(nextStocks);
    saveToCloud(nextStocks, manualAssets, loanAssets);
    setIsStockModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* 상단 헤더 & 원클릭 복구 버튼 */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-800 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2">
              🏛️ 가계 통합 자산관리 대시보드
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-400">상태:</span>
              <span className="text-xs text-emerald-400 font-bold">{syncStatus}</span>
              <button
                onClick={forceResetToPhotoData}
                className="text-[11px] bg-red-950/80 hover:bg-red-900 text-red-300 px-2 py-0.5 rounded border border-red-800 ml-2"
              >
                🚨 사진 데이터로 강제 원복
              </button>
            </div>
          </div>

          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
            {(['전체', '남편', '아내', '공통'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedOwner(tab)}
                className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition ${
                  selectedOwner === tab ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </header>

        {/* 액션 버튼 */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3 rounded-2xl">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">기준 환율:</span>
            <span className="text-sm font-black text-emerald-400">₩{exchangeRate.toLocaleString()}</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsManualModalOpen(true)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-700"
            >
              ⚙ 자가·전세·예금
            </button>
            <button
              onClick={() => setIsStockModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-md shadow-blue-900/30"
            >
              + 투자 종목 기입
            </button>
          </div>
        </div>

        {/* 최상위 순자산 카드 */}
        <div className="bg-gradient-to-br from-blue-950/70 via-slate-900 to-slate-900 border border-blue-900/50 p-6 rounded-3xl shadow-xl">
          <div className="flex flex-col md:flex-row justify-between md:items-end gap-5">
            <div>
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                [{selectedOwner}] 기준 총 순자산 (자산 - 대출)
              </span>
              <div className="text-3xl md:text-5xl font-black text-white mt-1">
                ₩ {Math.round(grandNetAssets).toLocaleString()}
                <span className="block text-xs font-normal text-slate-400 mt-1">
                  ({formatKoreanWon(grandNetAssets)})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-6 text-left">
              <div>
                <p className="text-[11px] text-slate-400">가용 자산</p>
                <p className="text-sm md:text-base font-bold text-emerald-400 mt-0.5">
                  ₩ {Math.round(liquidAssets).toLocaleString()}
                </p>
                <span className="text-[10px] text-slate-500">{formatKoreanWon(liquidAssets)}</span>
              </div>
              <div className="border-l border-slate-800 pl-3">
                <p className="text-[11px] text-slate-400">노후 자금</p>
                <p className="text-sm md:text-base font-bold text-amber-400 mt-0.5">
                  ₩ {Math.round(retirementAssets).toLocaleString()}
                </p>
                <span className="text-[10px] text-slate-500">{formatKoreanWon(retirementAssets)}</span>
              </div>
              <div className="border-l border-slate-800 pl-3">
                <p className="text-[11px] text-rose-400">총 대출</p>
                <p className="text-sm md:text-base font-bold text-rose-400 mt-0.5">
                  -₩ {Math.round(totalLoanAmount).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 자산 3대 영역 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 가용 자산 */}
          <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h2 className="font-bold text-sm text-slate-200">가용 가능한 금액</h2>
              <span className="font-bold text-emerald-400 text-xs">{formatKoreanWon(liquidAssets)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400">전세금</span>
                <p className="font-bold mt-0.5 text-white">₩{Math.round(jeonseVal).toLocaleString()}</p>
                <p className="text-[9px] text-slate-500">{formatKoreanWon(jeonseVal)}</p>
              </div>
              <div
                onClick={() => setExpandedCategory(expandedCategory === '해외직투' ? null : '해외직투')}
                className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 hover:border-blue-500 cursor-pointer"
              >
                <span className="text-[10px] text-blue-400 font-semibold">해외직투 ▾</span>
                <p className="font-bold mt-0.5 text-white">₩{Math.round(overseasStats.totalVal).toLocaleString()}</p>
              </div>
              <div
                onClick={() => setExpandedCategory(expandedCategory === '국내직투' ? null : '국내직투')}
                className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 hover:border-blue-500 cursor-pointer"
              >
                <span className="text-[10px] text-blue-400 font-semibold">국내직투 ▾</span>
                <p className="font-bold mt-0.5 text-white">₩{Math.round(domesticStats.totalVal).toLocaleString()}</p>
              </div>
              <div
                onClick={() => setExpandedCategory(expandedCategory === 'ISA' ? null : 'ISA')}
                className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 hover:border-blue-500 cursor-pointer"
              >
                <span className="text-[10px] text-blue-400 font-semibold">ISA ▾</span>
                <p className="font-bold mt-0.5 text-white">₩{Math.round(isaStats.totalVal).toLocaleString()}</p>
              </div>
            </div>
          </section>

          {/* 노후 자금 */}
          <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h2 className="font-bold text-sm text-slate-200">노후 자금</h2>
              <span className="font-bold text-amber-400 text-xs">{formatKoreanWon(retirementAssets)}</span>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div
                onClick={() => setExpandedCategory(expandedCategory === '개인연금저축' ? null : '개인연금저축')}
                className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 hover:border-amber-500 cursor-pointer flex justify-between items-center"
              >
                <span className="text-[10px] text-amber-400 font-semibold">개인연금저축 ▾</span>
                <p className="font-bold text-white">₩{Math.round(pensionStats.totalVal).toLocaleString()}</p>
              </div>
            </div>
          </section>

          {/* 대출 */}
          <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h2 className="font-bold text-sm text-slate-200">대출 현황</h2>
              <span className="font-bold text-rose-400 text-xs">0원</span>
            </div>
            <p className="text-xs text-slate-500 py-3 text-center">등록된 대출이 없습니다.</p>
          </section>
        </div>

        {/* 전체 종목 리스트 테이블 (13개 종목) */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm md:text-base font-bold text-slate-200">
              보유 투자 종목 리스트 ({stockAssets.length}개)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-950/60 text-slate-400 text-[11px] border-b border-slate-800">
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
              <tbody className="divide-y divide-slate-800/60">
                {stockAssets.map((item) => {
                  const { valKRW, roi } = getAssetKRW(item);
                  const isProfit = roi >= 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-semibold text-slate-300">{item.owner}</td>
                      <td className="py-2.5 px-3 text-slate-300">{item.category}</td>
                      <td className="py-2.5 px-3 font-bold text-white">
                        {item.name}
                        <span className="block text-[10px] font-normal text-slate-400">{item.ticker}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">{item.buyDate}</td>
                      <td className="py-2.5 px-3">{item.quantity.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {item.currency === 'USD' ? `$${item.buyPrice}` : `₩${item.buyPrice.toLocaleString()}`}
                      </td>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">
                        {item.currency === 'USD' ? `$${item.currentPrice}` : `₩${item.currentPrice.toLocaleString()}`}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-white">
                        ₩ {Math.round(valKRW).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`font-semibold ${isProfit ? 'text-red-400' : 'text-blue-400'}`}>
                          {isProfit ? '+' : ''}{roi.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => {
                            const next = stockAssets.filter((s) => s.id !== item.id);
                            setStockAssets(next);
                            saveToCloud(next, manualAssets, loanAssets);
                          }}
                          className="text-slate-500 hover:text-red-400 text-xs"
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

      </div>
    </div>
  );
}