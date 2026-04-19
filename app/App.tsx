import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { API_BASE_URL, lifeApi } from './src/api';
import { colors, shadows } from './src/theme';
import type { Dashboard, HealthReport, LifeMessage, LifeRecord, MainTab, Profile, RecordType, ReportType } from './src/types';

const emptyDashboard: Dashboard = {
  user_id: 'demo-user',
  greeting: '今天也和来福一起，好好照顾自己',
  today: {
    diet_calories: 0,
    exercise_calories: 0,
    health_count: 0,
    water_cups: 0
  },
  stats: {
    record_days: 0,
    total_records: 0,
    health_score: 82
  },
  recent_records: [],
  latest_report: null
};

const emptyProfile: Profile = {
  user_id: 'demo-user',
  nickname: '来福用户',
  gender: '未设置',
  age: 32,
  height: 170,
  weight: 65,
  target_weight: 62,
  activity_level: '轻度',
  allergies: [],
  family_history: [],
  health_goals: ['规律记录', '均衡饮食', '每周运动3次']
};

const tabItems: Array<{ key: MainTab; label: string; icon: string }> = [
  { key: 'home', label: '来福', icon: '⌂' },
  { key: 'reports', label: '报告', icon: '□' },
  { key: 'advisor', label: '顾问', icon: '◇' },
  { key: 'profile', label: '我的', icon: '○' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [dashboard, setDashboard] = useState<Dashboard>(emptyDashboard);
  const [records, setRecords] = useState<LifeRecord[]>([]);
  const [reports, setReports] = useState<HealthReport[]>([]);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recordModalVisible, setRecordModalVisible] = useState(false);

  const loadAll = useCallback(async () => {
    const [dashboardData, recordData, reportData, profileData] = await Promise.all([
      lifeApi.dashboard(),
      lifeApi.records(),
      lifeApi.reports(),
      lifeApi.profile()
    ]);
    setDashboard(dashboardData);
    setRecords(recordData);
    setReports(reportData);
    setProfile(profileData);
  }, []);

  useEffect(() => {
    loadAll()
      .catch(() => {
        Alert.alert('连接失败', `无法连接后端服务：${API_BASE_URL}\n请先启动 backend 服务。`);
      })
      .finally(() => setLoading(false));
  }, [loadAll]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  }, [loadAll]);

  const latestReport = reports[0] || dashboard.latest_report || null;

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="dark" />
      <View style={styles.shell}>
        {loading ? (
          <LoadingState />
        ) : (
          <View style={styles.content}>
            {activeTab === 'home' && (
              <HomeScreen
                dashboard={dashboard}
                latestReport={latestReport}
                onRefresh={refresh}
                refreshing={refreshing}
                onOpenRecord={() => setRecordModalVisible(true)}
                onGoReports={() => setActiveTab('reports')}
                onGoProfile={() => setActiveTab('profile')}
              />
            )}
            {activeTab === 'reports' && (
              <ReportsScreen
                reports={reports}
                onReportsChange={setReports}
                onRefresh={refresh}
                refreshing={refreshing}
              />
            )}
            {activeTab === 'advisor' && <AdvisorScreen />}
            {activeTab === 'profile' && (
              <ProfileScreen
                profile={profile}
                records={records}
                onRefresh={refresh}
                refreshing={refreshing}
              />
            )}
          </View>
        )}
        <TabBar activeTab={activeTab} onChange={setActiveTab} />
      </View>

      <RecordModal
        visible={recordModalVisible}
        onClose={() => setRecordModalVisible(false)}
        onSaved={refresh}
      />
    </SafeAreaView>
  );
}

function LoadingState() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>来福正在准备健康数据...</Text>
    </View>
  );
}

function HomeScreen({
  dashboard,
  latestReport,
  refreshing,
  onRefresh,
  onOpenRecord,
  onGoReports,
  onGoProfile
}: {
  dashboard: Dashboard;
  latestReport: HealthReport | null;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenRecord: () => void;
  onGoReports: () => void;
  onGoProfile: () => void;
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.topRow}>
        <View>
          <Text style={styles.kicker}>Life Health</Text>
          <Text style={styles.pageTitle}>今天想记录点什么？</Text>
        </View>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>福</Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>{dashboard.greeting}</Text>
        <View style={styles.scoreLine}>
          <View>
            <Text style={styles.scoreValue}>{dashboard.stats.health_score}</Text>
            <Text style={styles.heroMuted}>健康评分</Text>
          </View>
          <View style={styles.streakPill}>
            <Text style={styles.streakText}>连续记录 {dashboard.stats.record_days} 天</Text>
          </View>
        </View>
      </View>

      <View style={styles.metricGrid}>
        <MetricCard label="饮食摄入" value={`${dashboard.today.diet_calories}`} unit="千卡" color={colors.warning} />
        <MetricCard label="运动消耗" value={`${dashboard.today.exercise_calories}`} unit="千卡" color={colors.primary} />
        <MetricCard label="健康记录" value={`${dashboard.today.health_count}`} unit="条" color={colors.danger} />
      </View>

      <Pressable style={styles.bigRecordButton} onPress={onOpenRecord}>
        <Text style={styles.bigRecordIcon}>＋</Text>
        <View>
          <Text style={styles.bigRecordTitle}>记录</Text>
          <Text style={styles.bigRecordDesc}>说话、打字、拍照都可以</Text>
        </View>
      </Pressable>

      <View style={styles.quickRow}>
        <Pressable style={styles.quickCard} onPress={onGoReports}>
          <Text style={styles.quickTitle}>查看报告</Text>
          <Text style={styles.quickDesc}>{latestReport ? `${latestReport.score} 分 · ${latestReport.title}` : '生成健康周报'}</Text>
        </Pressable>
        <Pressable style={styles.quickCard} onPress={onGoProfile}>
          <Text style={styles.quickTitle}>历史趋势</Text>
          <Text style={styles.quickDesc}>记录、档案、目标</Text>
        </Pressable>
      </View>

      <SectionHeader title="最近记录" />
      {dashboard.recent_records.length ? (
        dashboard.recent_records.map((record) => <RecordCard key={record.id} record={record} />)
      ) : (
        <EmptyCard title="还没有记录" description="点击记录，让来福开始了解你的健康生活。" />
      )}
    </ScrollView>
  );
}

function ReportsScreen({
  reports,
  refreshing,
  onRefresh,
  onReportsChange
}: {
  reports: HealthReport[];
  refreshing: boolean;
  onRefresh: () => void;
  onReportsChange: (reports: HealthReport[]) => void;
}) {
  const [type, setType] = useState<ReportType>('weekly');
  const [generating, setGenerating] = useState(false);
  const latest = reports[0] || null;

  async function generate() {
    setGenerating(true);
    try {
      const report = await lifeApi.generateReport(type);
      onReportsChange([report, ...reports]);
    } catch {
      Alert.alert('生成失败', '请确认后端服务已启动。');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.topRow}>
        <View>
          <Text style={styles.kicker}>Health Report</Text>
          <Text style={styles.pageTitle}>健康报告</Text>
        </View>
      </View>

      <FilterTabs
        value={type}
        options={[
          ['weekly', '周报'],
          ['monthly', '月报']
        ]}
        onChange={(next) => setType(next as ReportType)}
      />

      <Pressable style={[styles.primaryButton, generating && styles.disabled]} onPress={generate} disabled={generating}>
        <Text style={styles.primaryButtonText}>{generating ? '生成中...' : `生成${type === 'weekly' ? '周报' : '月报'}`}</Text>
      </Pressable>

      {latest ? (
        <ReportDetail report={latest} />
      ) : (
        <EmptyCard title="还没有报告" description="生成一份报告，来福会汇总你的饮食、运动和健康指标。" />
      )}

      <SectionHeader title="历史报告" />
      {reports.map((report) => (
        <View key={report.id} style={styles.reportRow}>
          <View>
            <Text style={styles.cardTitle}>{report.title}</Text>
            <Text style={styles.mutedText}>{report.period_start} 至 {report.period_end}</Text>
          </View>
          <View style={styles.smallScore}>
            <Text style={styles.smallScoreText}>{report.score}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function AdvisorScreen() {
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<LifeMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '您好！我是您的AI健康顾问，可以帮你解读饮食、运动和健康指标。',
      time: '现在',
      quick_actions: ['血糖偏高怎么吃？', '今天饮食怎么样？', '血压怎么管理？']
    }
  ]);
  const [sessions, setSessions] = useState<Array<{ id: string; summary: string; messages: LifeMessage[]; updated_at: string }>>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [mode, setMode] = useState<'chat' | 'history'>('chat');

  const loadSessions = useCallback(async () => {
    try {
      setSessions(await lifeApi.advisorSessions());
    } catch {
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  async function send(text = input) {
    const value = text.trim();
    if (!value) return;
    setThinking(true);
    setInput('');
    try {
      const res = await lifeApi.advisorMessage({ session_id: sessionId || undefined, text: value });
      setSessionId(res.session_id);
      setMessages((prev) => [...prev, ...res.messages]);
      loadSessions();
    } catch {
      Alert.alert('发送失败', '请确认后端服务已启动。');
    } finally {
      setThinking(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.fixedHeader}>
        <View>
          <Text style={styles.kicker}>AI Advisor</Text>
          <Text style={styles.pageTitle}>健康顾问</Text>
        </View>
      </View>

      <FilterTabs
        value={mode}
        options={[
          ['chat', '健康对话'],
          ['history', '咨询记录']
        ]}
        onChange={(next) => setMode(next as 'chat' | 'history')}
      />

      {mode === 'chat' ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView style={styles.advisorMessages} contentContainerStyle={{ paddingBottom: 18 }}>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onQuick={(action) => {
                  setInput(action);
                  send(action);
                }}
              />
            ))}
            {thinking && <Text style={styles.thinkingText}>AI思考中...</Text>}
          </ScrollView>
          <View style={styles.advisorInputBar}>
            <TextInput
              style={styles.advisorInput}
              value={input}
              onChangeText={setInput}
              placeholder="问问你的健康问题..."
              placeholderTextColor={colors.muted}
              multiline
            />
            <Pressable style={[styles.sendButton, thinking && styles.disabled]} onPress={() => send()} disabled={thinking}>
              <Text style={styles.sendText}>发送</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              style={styles.sessionCard}
              onPress={() => {
                setSessionId(item.id);
                setMessages(item.messages);
                setMode('chat');
              }}
            >
              <Text style={styles.cardTitle}>{item.summary}</Text>
              <Text style={styles.mutedText}>{item.updated_at}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<EmptyCard title="还没有咨询记录" description="开始问 AI 顾问，来福会保存这次对话。" />}
        />
      )}
    </View>
  );
}

function ProfileScreen({
  profile,
  records,
  refreshing,
  onRefresh
}: {
  profile: Profile;
  records: LifeRecord[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const dietCount = records.filter((record) => record.type === 'diet').length;
  const exerciseCount = records.filter((record) => record.type === 'exercise').length;
  const healthCount = records.filter((record) => record.type === 'health').length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>福</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>{profile.nickname}</Text>
          <Text style={styles.mutedText}>{profile.age}岁 · {profile.height}cm · {profile.weight}kg</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>{profile.activity_level || '轻度'}</Text>
        </View>
      </View>

      <View style={styles.metricGrid}>
        <MetricCard label="饮食" value={`${dietCount}`} unit="条" color={colors.warning} />
        <MetricCard label="运动" value={`${exerciseCount}`} unit="条" color={colors.primary} />
        <MetricCard label="健康" value={`${healthCount}`} unit="条" color={colors.danger} />
      </View>

      <SectionHeader title="健康目标" />
      <View style={styles.card}>
        {profile.health_goals.map((goal) => (
          <Text key={goal} style={styles.goalText}>✓ {goal}</Text>
        ))}
      </View>

      <SectionHeader title="档案管理" />
      <View style={styles.quickRow}>
        <View style={styles.quickCard}>
          <Text style={styles.quickTitle}>病历</Text>
          <Text style={styles.quickDesc}>诊断、治疗、附件</Text>
        </View>
        <View style={styles.quickCard}>
          <Text style={styles.quickTitle}>体检报告</Text>
          <Text style={styles.quickDesc}>上传后 AI 分析</Text>
        </View>
      </View>

      <SectionHeader title="最近记录" />
      {records.slice(0, 5).map((record) => <RecordCard key={record.id} record={record} />)}
    </ScrollView>
  );
}

function RecordModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState<LifeMessage[]>([]);
  const [input, setInput] = useState('');
  const [pendingRecord, setPendingRecord] = useState<Record<string, unknown> | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!visible) return;
    lifeApi
      .startRecordConversation()
      .then((res) => {
        setConversationId(res.conversation_id);
        setMessages([res.message]);
        setPendingRecord(null);
        setInput('');
      })
      .catch(() => {
        setMessages([
          {
            id: 'offline',
            role: 'assistant',
            content: '后端服务暂不可用，请稍后再试。',
            time: '现在',
            quick_actions: []
          }
        ]);
      });
  }, [visible]);

  async function send(text = input) {
    const value = text.trim();
    if (!value) return;
    setProcessing(true);
    try {
      const res = await lifeApi.sendRecordMessage({ conversation_id: conversationId, text: value });
      setConversationId(res.conversation_id);
      setMessages((prev) => [...prev, ...res.messages]);
      setPendingRecord(res.pending_record);
      setInput('');
    } catch {
      Alert.alert('分析失败', '来福暂时没理解，请确认后端服务已启动。');
    } finally {
      setProcessing(false);
    }
  }

  async function confirm(confirmed: boolean) {
    if (!pendingRecord) return;
    setProcessing(true);
    try {
      const res = await lifeApi.confirmRecord({
        conversation_id: conversationId,
        pending_record: pendingRecord,
        confirmed
      });
      setMessages((prev) => [...prev, ...res.messages]);
      setPendingRecord(res.pending_record);
      if (confirmed) {
        onSaved();
      }
    } catch {
      Alert.alert('保存失败', '请稍后重试。');
    } finally {
      setProcessing(false);
    }
  }

  function handleQuick(action: string) {
    if (action === '完成') {
      onClose();
      return;
    }
    if (action === '继续记录') {
      setInput('');
      return;
    }
    if (!pendingRecord) {
      setInput(action);
      return;
    }
    if (action === '对的' || action === '是的') {
      confirm(true);
      return;
    }
    if (action === '不对' || action === '不是') {
      confirm(false);
      return;
    }
    setInput('补充：');
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
        <Pressable style={styles.modalMask} onPress={onClose} />
        <View style={styles.modalPanel}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>统一记录</Text>
              <Text style={styles.mutedText}>饮食、运动、健康都可以自然表达</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.messageList} contentContainerStyle={{ paddingBottom: 16 }}>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} onQuick={handleQuick} />
            ))}
            {processing && <Text style={styles.thinkingText}>AI正在分析...</Text>}
          </ScrollView>

          <View style={styles.tipRow}>
            {['我早餐吃了一个包子、一杯豆浆、一个鸡蛋', '我今天跑步5公里，用时30分钟', '我今天血压高压135，低压85，心率72'].map((tip) => (
              <Pressable key={tip} style={styles.tipChip} onPress={() => setInput(tip)}>
                <Text style={styles.tipText}>{tip.slice(0, 5)}...</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.inputBar}>
            <Pressable style={styles.roundTool} onPress={() => Alert.alert('语音输入', '首版保留入口，后续接入系统语音能力。')}>
              <Text style={styles.roundToolText}>声</Text>
            </Pressable>
            <TextInput
              style={styles.modalInput}
              value={input}
              onChangeText={setInput}
              placeholder="打字告诉来福..."
              placeholderTextColor={colors.muted}
              multiline
            />
            <Pressable style={[styles.sendButton, processing && styles.disabled]} onPress={() => send()} disabled={processing}>
              <Text style={styles.sendText}>发送</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MessageBubble({ message, onQuick }: { message: LifeMessage; onQuick: (action: string) => void }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
      <View style={[styles.messageAvatar, isUser && styles.messageAvatarUser]}>
        <Text style={styles.messageAvatarText}>{isUser ? '我' : '福'}</Text>
      </View>
      <View style={[styles.bubble, isUser && styles.bubbleUser]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{message.content}</Text>
        {!!message.quick_actions?.length && (
          <View style={styles.bubbleActions}>
            {message.quick_actions.map((action) => (
              <Pressable key={action} style={styles.bubbleAction} onPress={() => onQuick(action)}>
                <Text style={styles.bubbleActionText}>{action}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Text style={[styles.messageTime, isUser && styles.messageTimeUser]}>{message.time}</Text>
      </View>
    </View>
  );
}

function ReportDetail({ report }: { report: HealthReport }) {
  return (
    <View style={styles.reportCard}>
      <View style={styles.reportTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.reportTitle}>{report.title}</Text>
          <Text style={styles.mutedText}>{report.period_start} 至 {report.period_end}</Text>
        </View>
        <View style={styles.scoreCircle}>
          <Text style={styles.scoreCircleText}>{report.score}</Text>
        </View>
      </View>
      <Text style={styles.reportSummary}>{report.summary}</Text>
      {report.content.sections?.map((section) => (
        <View key={section.title} style={styles.reportSection}>
          <Text style={styles.cardTitle}>{section.title}</Text>
          {section.items.map((item) => (
            <Text key={item} style={styles.reportLine}>• {item}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function RecordCard({ record }: { record: LifeRecord }) {
  const meta = recordTypeMeta(record.type);
  return (
    <View style={styles.recordCard}>
      <View style={styles.recordTop}>
        <View style={[styles.recordTypeBadge, { backgroundColor: meta.bg }]}>
          <Text style={[styles.recordTypeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <Text style={styles.recordDate}>{record.recorded_at.slice(5, 16)}</Text>
      </View>
      <Text style={styles.cardTitle}>{record.title}</Text>
      <Text style={styles.recordSummary}>{record.ai_analysis.summary || '已保存记录'}</Text>
      <Text style={styles.recordSuggestion}>{record.ai_analysis.suggestion || '保持记录，来福会逐渐了解你的健康趋势。'}</Text>
    </View>
  );
}

function MetricCard({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricUnit}>{unit}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function FilterTabs({ value, options, onChange }: { value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return (
    <View style={styles.filterTabs}>
      {options.map(([key, label]) => (
        <Pressable key={key} style={[styles.filterTab, value === key && styles.filterTabActive]} onPress={() => onChange(key)}>
          <Text style={[styles.filterTabText, value === key && styles.filterTabTextActive]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function EmptyCard({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDesc}>{description}</Text>
    </View>
  );
}

function TabBar({ activeTab, onChange }: { activeTab: MainTab; onChange: (tab: MainTab) => void }) {
  return (
    <View style={styles.tabBar}>
      {tabItems.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <Pressable key={tab.key} style={styles.tabItem} onPress={() => onChange(tab.key)}>
            <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function recordTypeMeta(type: RecordType) {
  if (type === 'diet') {
    return { label: '饮食', color: colors.warning, bg: colors.softAmber };
  }
  if (type === 'exercise') {
    return { label: '运动', color: colors.primary, bg: colors.softBlue };
  }
  return { label: '健康', color: colors.danger, bg: colors.softRed };
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.bg
  },
  shell: {
    flex: 1,
    backgroundColor: colors.bg
  },
  content: {
    flex: 1
  },
  screen: {
    flex: 1,
    backgroundColor: colors.bg
  },
  screenContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 104
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18
  },
  kicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0
  },
  pageTitle: {
    marginTop: 4,
    color: colors.text,
    fontSize: 24,
    fontWeight: '700'
  },
  logoMark: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700'
  },
  heroCard: {
    padding: 20,
    borderRadius: 8,
    backgroundColor: colors.primary,
    ...shadows.card
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26
  },
  scoreLine: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between'
  },
  scoreValue: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '700',
    lineHeight: 52
  },
  heroMuted: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13
  },
  streakPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.16)'
  },
  streakText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12
  },
  metricCard: {
    flex: 1,
    minHeight: 106,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    ...shadows.card
  },
  metricValue: {
    fontSize: 25,
    fontWeight: '700'
  },
  metricUnit: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12
  },
  metricLabel: {
    marginTop: 12,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700'
  },
  bigRecordButton: {
    minHeight: 92,
    marginTop: 14,
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.success
  },
  bigRecordIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.16)',
    color: '#FFFFFF',
    fontSize: 36,
    lineHeight: 48,
    textAlign: 'center'
  },
  bigRecordTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700'
  },
  bigRecordDesc: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.84)',
    fontSize: 13
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12
  },
  quickCard: {
    flex: 1,
    minHeight: 84,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    ...shadows.card
  },
  quickTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700'
  },
  quickDesc: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700'
  },
  recordCard: {
    marginBottom: 10,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    ...shadows.card
  },
  recordTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  recordTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8
  },
  recordTypeText: {
    fontSize: 12,
    fontWeight: '700'
  },
  recordDate: {
    color: colors.muted,
    fontSize: 12
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700'
  },
  recordSummary: {
    marginTop: 8,
    color: colors.text,
    fontSize: 14,
    lineHeight: 21
  },
  recordSuggestion: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.softGreen,
    color: colors.success,
    fontSize: 13,
    lineHeight: 19
  },
  emptyCard: {
    padding: 22,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center'
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700'
  },
  emptyDesc: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19
  },
  fixedHeader: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  advisorMessages: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 8
  },
  advisorInputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 96 : 88,
    backgroundColor: colors.bg
  },
  advisorInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 96,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    color: colors.text,
    fontSize: 14
  },
  sessionCard: {
    marginBottom: 10,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    ...shadows.card
  },
  headerAction: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary
  },
  headerActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 18,
    marginTop: 6,
    marginBottom: 12,
    padding: 4,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line
  },
  filterTab: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterTabActive: {
    backgroundColor: colors.primary
  },
  filterTabText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700'
  },
  filterTabTextActive: {
    color: '#FFFFFF'
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 104
  },
  primaryButton: {
    height: 44,
    marginTop: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700'
  },
  disabled: {
    opacity: 0.55
  },
  reportCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    ...shadows.card
  },
  reportTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  reportTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700'
  },
  mutedText: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18
  },
  scoreCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.softBlue,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scoreCircleText: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '700'
  },
  reportSummary: {
    marginTop: 14,
    color: colors.text,
    fontSize: 14,
    lineHeight: 21
  },
  reportSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line
  },
  reportLine: {
    marginTop: 7,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19
  },
  reportRow: {
    marginBottom: 10,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  smallScore: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  smallScoreText: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  profileCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...shadows.card
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700'
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.softGreen
  },
  statusBadgeText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700'
  },
  card: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    ...shadows.card
  },
  goalText: {
    paddingVertical: 6,
    color: colors.success,
    fontSize: 14,
    lineHeight: 20
  },
  tabBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: Platform.OS === 'ios' ? 18 : 12,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    flexDirection: 'row',
    ...shadows.card
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2
  },
  tabIcon: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: '700'
  },
  tabIconActive: {
    color: colors.primary
  },
  tabLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700'
  },
  tabLabelActive: {
    color: colors.primary
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  modalMask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.34)'
  },
  modalPanel: {
    height: '84%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: colors.bg,
    overflow: 'hidden'
  },
  modalHeader: {
    padding: 18,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700'
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg
  },
  closeText: {
    color: colors.muted,
    fontSize: 28,
    lineHeight: 30
  },
  messageList: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16
  },
  messageRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
    alignItems: 'flex-start'
  },
  messageRowUser: {
    flexDirection: 'row-reverse'
  },
  messageAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary
  },
  messageAvatarUser: {
    backgroundColor: colors.text
  },
  messageAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  bubble: {
    maxWidth: '78%',
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line
  },
  bubbleUser: {
    backgroundColor: colors.text,
    borderColor: colors.text
  },
  bubbleText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21
  },
  bubbleTextUser: {
    color: '#FFFFFF'
  },
  bubbleActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10
  },
  bubbleAction: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.softBlue
  },
  bubbleActionText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700'
  },
  messageTime: {
    marginTop: 7,
    color: colors.muted,
    fontSize: 11
  },
  messageTimeUser: {
    color: 'rgba(255,255,255,0.72)'
  },
  thinkingText: {
    marginLeft: 44,
    color: colors.muted,
    fontSize: 13
  },
  tipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.line
  },
  tipChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.softBlue
  },
  tipText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700'
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 14,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    backgroundColor: colors.card
  },
  roundTool: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary
  },
  roundToolText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  modalInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 96,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.bg,
    color: colors.text,
    fontSize: 14
  },
  sendButton: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary
  },
  sendText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  }
});
