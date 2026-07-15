import { Alert, Skeleton } from 'antd'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { useDashboardSummary } from '../api/queries'
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

export default function DashboardPage() {
  const { data, isLoading, isError } = useDashboardSummary()
  const navigate = useNavigate()

  // 일차별 막대 (active_rooms.by_day) — 마지막 일차는 "최종"
  const dayEntries = data
    ? Object.entries(data.active_rooms.by_day).sort(([a], [b]) => Number(a) - Number(b))
    : []
  const maxDay = Math.max(1, ...dayEntries.map(([, v]) => v))
  const lastDay = dayEntries.length ? dayEntries[dayEntries.length - 1][0] : null

  // 성비 (여:남)
  const q = data?.matching_queue
  const ratio = q && q.male > 0 ? `${(q.female / q.male).toFixed(1)}:1` : '—'

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

                  {/* 매칭 대기열 (실데이터) */}
                  <div className="kpi">
                    <div className="top">
                      <span className="label">매칭 대기열</span>
                      <span className="ic violet">🔀</span>
                    </div>
                    <div className="val">
                      {q?.total ?? 0}
                      <small>명</small>
                    </div>
                    <div className="meta">
                      여 {q?.female ?? 0} · 남 {q?.male ?? 0} · 성비 {ratio}
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

                {/* Row: 추세(추후) + 매칭 도넛(추후) */}
                <div className="row">
                  <div className="panel">
                    <div className="ph">
                      <h3 className="soon-head">
                        가입 · 참가신청 추세 <span className="fpill">추후</span>
                      </h3>
                      <div className="legend">
                        <span>
                          <i style={{ background: 'var(--blue)' }} />
                          가입
                        </span>
                        <span>
                          <i style={{ background: 'var(--violet)' }} />
                          참가신청
                        </span>
                      </div>
                    </div>
                    <div className="pb">
                      <Soon label="추세 지표는 후속(/dashboard/metrics) 연동 예정">
                        <svg viewBox="0 0 620 200" width="100%" height={200} preserveAspectRatio="none">
                          <g stroke="#eff1f4" strokeWidth={1}>
                            <line x1="0" y1="40" x2="620" y2="40" />
                            <line x1="0" y1="90" x2="620" y2="90" />
                            <line x1="0" y1="140" x2="620" y2="140" />
                            <line x1="0" y1="180" x2="620" y2="180" />
                          </g>
                          <path
                            d="M10,150 L60,140 L110,148 L160,120 L210,128 L260,105 L310,112 L360,90 L410,96 L460,72 L510,80 L560,60 L610,66 L610,180 L10,180 Z"
                            fill="rgba(124,92,255,.10)"
                          />
                          <polyline
                            points="10,150 60,140 110,148 160,120 210,128 260,105 310,112 360,90 410,96 460,72 510,80 560,60 610,66"
                            fill="none"
                            stroke="var(--violet)"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M10,160 L60,152 L110,158 L160,138 L210,144 L260,126 L310,132 L360,116 L410,120 L460,102 L510,108 L560,92 L610,96 L610,180 L10,180 Z"
                            fill="rgba(22,119,255,.10)"
                          />
                          <polyline
                            points="10,160 60,152 110,158 160,138 210,144 260,126 310,132 360,116 410,120 460,102 510,108 560,92 610,96"
                            fill="none"
                            stroke="var(--blue)"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            color: 'var(--text-3)',
                            fontSize: 11,
                            padding: '2px 4px 0',
                          }}
                        >
                          <span>6/18</span>
                          <span>6/22</span>
                          <span>6/26</span>
                          <span>6/30</span>
                          <span>오늘</span>
                        </div>
                      </Soon>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="ph">
                      <h3 className="soon-head">
                        매칭 현황 <span className="fpill">추후</span>
                      </h3>
                      <span className="hint">오늘 배정 기준</span>
                    </div>
                    <div className="pb">
                      <Soon label="매칭 성사율은 후속 연동 예정">
                        <div className="donut-wrap">
                          <div className="donut-center">
                            <svg width={132} height={132} viewBox="0 0 132 132">
                              <circle cx="66" cy="66" r="52" fill="none" stroke="#eef0f3" strokeWidth={16} />
                              <circle
                                cx="66"
                                cy="66"
                                r="52"
                                fill="none"
                                stroke="var(--green)"
                                strokeWidth={16}
                                strokeDasharray="326.7"
                                strokeDashoffset="104.5"
                                strokeLinecap="round"
                                transform="rotate(-90 66 66)"
                              />
                            </svg>
                            <div className="cval">
                              <b>68%</b>
                              <span>매칭 성사율</span>
                            </div>
                          </div>
                          <div className="dstat">
                            <div className="li">
                              <span className="k">
                                <span className="sw" style={{ background: 'var(--green)' }} />방 배정됨
                              </span>
                              <span className="v">23명</span>
                            </div>
                            <div className="li">
                              <span className="k">
                                <span className="sw" style={{ background: '#eef0f3' }} />대기 중
                              </span>
                              <span className="v">11명</span>
                            </div>
                            <div className="li">
                              <span className="k">오늘 생성된 방</span>
                              <span className="v">4개</span>
                            </div>
                            <div className="li">
                              <span className="k">평균 대기시간</span>
                              <span className="v">2.4h</span>
                            </div>
                          </div>
                        </div>
                      </Soon>
                    </div>
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
