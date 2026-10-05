import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
  }

  const clean = ticker.trim().toUpperCase();
  let formatted = clean;

  // 국내 6자리 숫자 종목코드 처리 (예: 005930 -> 005930.KS)
  if (/^\d{6}$/.test(clean)) {
    formatted = `${clean}.KS`;
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${formatted}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      next: { revalidate: 10 }, // 10초 캐싱
    });

    if (res.ok) {
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      const price = meta?.regularMarketPrice;
      const currency = meta?.currency;

      if (price && typeof price === 'number') {
        const isKRW = formatted.endsWith('.KS') || formatted.endsWith('.KQ') || currency === 'KRW';
        return NextResponse.json({
          price: isKRW ? Math.round(price) : Math.round(price * 100) / 100,
          currency: isKRW ? 'KRW' : 'USD',
        });
      }
    }

    // 코스닥(.KQ) fallback 조회
    if (/^\d{6}\.KS$/.test(formatted)) {
      const kqTicker = formatted.replace('.KS', '.KQ');
      const resKq = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${kqTicker}?interval=1d&range=1d`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (resKq.ok) {
        const dataKq = await resKq.json();
        const priceKq = dataKq?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (priceKq && typeof priceKq === 'number') {
          return NextResponse.json({
            price: Math.round(priceKq),
            currency: 'KRW',
          });
        }
      }
    }

    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}