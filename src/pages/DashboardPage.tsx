import { Card, Col, Row, Statistic, Progress, Empty, Alert, Skeleton } from 'antd'
import { HomeOutlined, TeamOutlined, UserAddOutlined } from '@ant-design/icons'
import { PageHeader } from '../layout/AdminLayout'
import { useDashboardSummary } from '../api/queries'
import { colors } from '../theme'

export default function DashboardPage() {
  const { data, isLoading, isError } = useDashboardSummary()

  if (isError) return <Alert type="error" message="대시보드 데이터를 불러오지 못했습니다." showIcon />

  return (
    <>
      <PageHeader title="운영 대시보드" subtitle="오늘 서비스가 건강하게 돌아가고 있는지 한눈에" />
      <Skeleton loading={isLoading} active paragraph={{ rows: 6 }}>
        {data && (
          <>
            <Row gutter={16}>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="활성 방(세션)"
                    value={data.active_rooms.total}
                    prefix={<HomeOutlined style={{ color: colors.violet }} />}
                    suffix="개"
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="매칭 대기열"
                    value={data.matching_queue.total}
                    prefix={<TeamOutlined style={{ color: '#1677ff' }} />}
                    suffix="명"
                  />
                  <div style={{ marginTop: 8, color: colors.textSecondary, fontSize: 13 }}>
                    여성 {data.matching_queue.female} · 남성 {data.matching_queue.male}
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="오늘 가입"
                    value={data.today_signups}
                    prefix={<UserAddOutlined style={{ color: '#22a06b' }} />}
                    suffix="명"
                  />
                </Card>
              </Col>
            </Row>

            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={12}>
                <Card title="일차별 활성 방 분포">
                  {Object.keys(data.active_rooms.by_day).length === 0 ? (
                    <Empty description="활성 방 없음" />
                  ) : (
                    Object.entries(data.active_rooms.by_day)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([day, count]) => (
                        <div key={day} style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span>{day}일차</span>
                            <span>{count}개</span>
                          </div>
                          <Progress
                            percent={
                              data.active_rooms.total
                                ? Math.round((count / data.active_rooms.total) * 100)
                                : 0
                            }
                            showInfo={false}
                            strokeColor={colors.violet}
                          />
                        </div>
                      ))
                  )}
                </Card>
              </Col>
              <Col span={12}>
                <Card title="추세 · 매칭 성사율">
                  {/* 명세: /dashboard/metrics 는 백엔드 후속. 준비되면 차트 연동 */}
                  <Empty description="추세 차트는 백엔드 후속(/dashboard/metrics) 연동 예정" />
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Skeleton>
    </>
  )
}
