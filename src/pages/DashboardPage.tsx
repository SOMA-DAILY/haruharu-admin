import { Alert, Empty, Skeleton } from 'antd'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { useDashboardMetrics, useDashboardSummary } from '../api/queries'
import type { DashboardMetrics } from '../api/types'
import './DashboardPage.css'

// API 없는 섹션 공통 래퍼: 목업 비주얼은 유지하되 회색+마스크로 "추후" 표시
function Soon({ children, label = '추후 제공' }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="soon-body">
      <div className="soon-inner">{children}</div>
      <div className="soon-mask">
        <span>🔒 {label}</span>
      </div>
    </div>
  )
}

// 가입 추세 (metrics) — 목업 SVG 스타일 유지, 의존성 없이 실데이터로 렌더
function TrendChart({ signups }: { signups: DashboardMetrics['signups'] }) {
  const dates = signups.map((s) => s.date)
  const n = dates.length
  if (n === 0) return <Empty description="기간 내 데이터 없음" />

  const TOP = 20,
    BOT = 180,
    X0 = 10,
    X1 = 610
  const signupVals = signups.map((s) => s.count)
  const maxV = Math.max(1, ...signupVals)
  const xAt = (i: number) => (n <= 1 ? (X0 + X1) / 2 : X0 + (i / (n - 1)) * (X1 - X0))
  const yAt = (v: number) => BOT - (v / maxV) * (BOT - TOP)
  const pts = (vals: number[]) => vals.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ')
  const area = (vals: number[]) =>
    vals.length
      ? `M ${xAt(0).toFixed(1)},${BOT} L ${vals
          .map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`)
          .join(' L ')} L ${xAt(vals.length - 1).toFixed(1)},${BOT} Z`
      : ''

  // x축 라벨 최대 5개(마지막은 '오늘'이면 표기)
  const labelIdx = n === 1 ? [0] : [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (n - 1)))
  const today = dayjs().format('YYYY-MM-DD')

  return (
    <>
      <svg viewBox="0 0 620 200" width="100%" height={200} preserveAspectRatio="none">
        <g stroke="#eff1f4" strokeWidth={1}>
          <line x1="0" y1="40" x2="620" y2="40" />
          <line x1="0" y1="90" x2="620" y2="90" />
          <line x1="0" y1="140" x2="620" y2="140" />
          <line x1="0" y1="180" x2="620" y2="180" />
        </g>
        {signupVals.length > 0 && (
          <>
            <path d={area(signupVals)} fill="rgba(22,119,255,.10)" />
            <polyline points={pts(signupVals)} fill="none" stroke="var(--blue)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-3)', fontSize: 11, padding: '2px 4px 0' }}>
        {[...new Set(labelIdx)].map((i) => (
          <span key={i}>{dates[i] === today ? '오늘' : dayjs(dates[i]).format('M/D')}</span>
        ))}
      </div>
    </>
  )
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useDashboardSummary()
  const { data: metrics, isLoading: metricsLoading, isError: metricsError } = useDashboardMetrics()
  const navigate = useNavigate()

  // 일차별 막대 (active_rooms.by_day) — 마지막 일차는 "최종"
  const dayEntries = data
    ? Object.entries(data.active_rooms.by_day).sort(([a], [b]) => Number(a) - Number(b))
    : []
  const maxDay = Math.max(1, ...dayEntries.map(([, v]) => v))
  const lastDay = dayEntries.length ? dayEntries[dayEntries.length - 1][0] : null

  return (
    <div className="dash">
      <div className="topbar">
        <div>
          <h1>운영 대시보드</h1>
          <div className="sub">오늘 서비스가 건강하게 돌아가고 있는지 한눈에</div>
        </div>
        <div className="spacer" />
        <div className="seg" title="기간별 지표는 추후(/dashboard/metrics) 연동 예정">
          <button>실시간</button>
          <button className="on">오늘</button>
          <button>7일</button>
          <button>30일</button>
        </div>
        <div className="icon-btn">
          🔔<span className="dot" />
        </div>
      </div>

      <div className="content">
        <div className="updated">
          <span className="live" /> 실시간 · 방금 업데이트됨 ({dayjs().format('YYYY-MM-DD HH:mm')})
        </div>

        {isError ? (
          <Alert type="error" showIcon message="대시보드 데이터를 불러오지 못했습니다." />
        ) : (
          <Skeleton loading={isLoading} active paragraph={{ rows: 10 }}>
            {data && (
              <>
                {/* KPI */}
                <div className="kpis">
                  {/* 진행중 방 (실데이터) */}
                  <div className="kpi">
                    <div className="top">
                      <span className="label">진행중 방</span>
                      <span className="ic blue">🏠</span>
                    </div>
                    <div className="val">
                      {data.active_rooms.total}
                      <small>개</small>
                    </div>
                    <div className="daybars">
                      {dayEntries.length ? (
                        dayEntries.map(([day, count]) => (
                          <div className="db" key={day}>
                            <div
                              className="bar"
                              style={{ height: Math.max(4, Math.round((count / maxDay) * 14)) }}
                            />
                            <div className="t">
                              {day === lastDay ? '최종' : `${day}일차`} {count}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="t" style={{ color: 'var(--text-3)' }}>
                          활성 방 없음
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 오늘 가입 (실데이터) */}
                  <div className="kpi">
                    <div className="top">
                      <span className="label">오늘 가입</span>
                      <span className="ic green">📈</span>
                    </div>
                    <div className="val">
                      {data.today_signups}
                      <small>명</small>
                    </div>
                    <div className="meta">누적 신규 가입</div>
                    <a className="foot-link" onClick={() => navigate('/users')}>
                      유저 관리 →
                    </a>
                  </div>

                  {/* IAP 검증 실패 (추후 — 백엔드 미추적) */}
                  <div className="kpi">
                    <div className="top">
                      <span className="label">IAP 검증 실패</span>
                      <span className="ic red">⚠️</span>
                    </div>
                    <div className="val" style={{ color: 'var(--text-3)' }}>
                      추후
                    </div>
                    <div className="meta">지표 준비중 (백엔드 미추적)</div>
                  </div>
                </div>

                {/* 가입 추세 (metrics) — 자동매칭 지표 제거(BE #452) 후 전폭 */}
                <div className="panel" style={{ marginBottom: 16 }}>
                  <div className="ph">
                    <h3>가입 추세</h3>
                    <div className="legend">
                      <span>
                        <i style={{ background: 'var(--blue)' }} />
                        가입
                      </span>
                      <span className="hint" style={{ marginLeft: 'auto' }}>
                        {metrics ? `${metrics.range.from} ~ ${metrics.range.to}` : '최근 추이'}
                      </span>
                    </div>
                  </div>
                  <div className="pb">
                    {metricsError ? (
                      <Alert type="error" showIcon message="추이 데이터를 불러오지 못했습니다." />
                    ) : metricsLoading || !metrics ? (
                      <Skeleton.Node active style={{ width: '100%', height: 200 }}>
                        <div />
                      </Skeleton.Node>
                    ) : (
                      <TrendChart signups={metrics.signups} />
                    )}
                  </div>
                </div>

                {/* Row2: IAP 실패 큐(추후) + 신고 큐(placeholder) */}
                <div className="row2">
                  <div className="panel">
                    <div className="ph">
                      <h3 className="soon-head">
                        IAP 검증 실패 큐 <span className="fpill">추후</span>
                      </h3>
                    </div>
                    <div className="pb" style={{ paddingTop: 0 }}>
                      <Soon label="IAP 검증 실패 큐는 후속 연동 예정">
                        <table>
                          <thead>
                            <tr>
                              <th>주문</th>
                              <th>유저</th>
                              <th>상품</th>
                              <th>스토어</th>
                              <th>상태</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="mono">#IAP-8842</td>
                              <td>
                                여울님 <span className="mono">a3f…</span>
                              </td>
                              <td>코인 30개</td>
                              <td>
                                <span className="badge-s b-apple"> Apple</span>
                              </td>
                              <td>
                                <span className="badge-s b-fail">검증실패</span>
                              </td>
                            </tr>
                            <tr>
                              <td className="mono">#IAP-8839</td>
                              <td>
                                초코님 <span className="mono">7b1…</span>
                              </td>
                              <td>코인 10개</td>
                              <td>
                                <span className="badge-s b-google">Google</span>
                              </td>
                              <td>
                                <span className="badge-s b-fail">검증실패</span>
                              </td>
                            </tr>
                            <tr>
                              <td className="mono">#IAP-8830</td>
                              <td>
                                바다님 <span className="mono">c92…</span>
                              </td>
                              <td>코인 30개</td>
                              <td>
                                <span className="badge-s b-apple"> Apple</span>
                              </td>
                              <td>
                                <span className="badge-s b-pend">웹훅 대기</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </Soon>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="ph">
                      <h3>신고 미처리 큐</h3>
                      <span className="hint">③ 안전 관리</span>
                    </div>
                    <div className="pb">
                      <div className="empty-lock">
                        <div className="lk">🔒</div>
                        <b>아직 활성화되지 않았어요</b>
                        <small>신고(reports) 스키마·콘텐츠 도메인 구현 후 자동 연동됩니다</small>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Future: 세션 품질 지표 */}
                <div className="future">
                  <div className="fh">
                    <h3>세션 품질 지표</h3>
                    <span className="fpill">영상·이벤트 도메인 구현 후 제공</span>
                  </div>
                  <div className="fg">
                    <div className="fc">
                      <div className="fl">📹 업로드율</div>
                      <div className="fv">— %</div>
                      <div className="fn">하루 미션 영상 업로드 / 방 인원</div>
                    </div>
                    <div className="fc">
                      <div className="fl">👀 열람률</div>
                      <div className="fv">— %</div>
                      <div className="fn">피드 열람 유저 / 방 인원</div>
                    </div>
                    <div className="fc">
                      <div className="fl">🚪 이탈률</div>
                      <div className="fv">— %</div>
                      <div className="fn">중도 이탈 / 참여 시작</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </Skeleton>
        )}
      </div>
    </div>
  )
}
