export interface SleepSession {
  start: string;
  end: string;
  duration: number;
}

export interface UserProfile {
  name?: string;
  age?: string;
  height?: string;
  weight?: string;
}

export interface RecommendationContext {
  session?: SleepSession;
  profile?: UserProfile;
  recentSessions?: SleepSession[];
  language?: 'en' | 'zh';
}

export interface DailyRecommendation {
  headline: string;
  foodPlan: MealPlanItem[];
  movementPlan: MovementPlan;
  mindset: string;
  tonight: string;
  source: 'groq' | 'local';
  fallbackReason?: string;
  createdAt: string;
  language?: 'en' | 'zh';
  promptVersion?: string;
}

export interface MealPlanItem {
  timing: string;
  meal: string;
  portion: string;
}

export interface MovementPlan {
  activity: string;
  durationMinutes: number;
  intensity: string;
  timing: string;
  warmUp: MovementStep[];
  workout: MovementStep[];
  coolDown: MovementStep[];
  lowerEnergyAlternative: string;
}

export interface MovementStep {
  name: string;
  durationMinutes: number;
  instruction: string;
}

interface RecommendationGatewayResponse {
  recommendation?: unknown;
  provider?: 'groq';
  error?: string;
}

const RECOMMENDATION_API_URL = process.env.EXPO_PUBLIC_RECOMMENDATION_API_URL;
const GEMINI_REQUEST_TIMEOUT_MS = 45_000;
export const RECOMMENDATION_PROMPT_VERSION = 'zh-native-v2';

export function getLocalRecommendation(session?: SleepSession, profile?: UserProfile, language: 'en' | 'zh' = 'en'): DailyRecommendation {
  const duration = session?.duration;
  const name = profile?.name?.trim();
  const hoursLabel = typeof duration === 'number' ? `${duration.toFixed(1)} hours` : 'your sleep';
  const sleptLessThanSevenHours = typeof duration === 'number' && duration < 7;

  if (language === 'zh') {
    const hours = typeof duration === 'number' ? `${duration.toFixed(1)} 小时` : '这次睡眠';
    return {
      headline: sleptLessThanSevenHours
        ? `${name ? `${name}，` : ''}睡眠不足会让人感觉疲惫，但这并不能说明什么。`
        : `${name ? `${name}，` : ''}${hours}的休息为今天打下了良好基础。`,
      foodPlan: sleptLessThanSevenHours
        ? [
            { timing: '醒来后 1 小时内', meal: '一碗燕麦、希腊酸奶、一根香蕉和一小把核桃', portion: '1 碗燕麦 + 150 克酸奶 + 1 根香蕉 + 20 克核桃' },
            { timing: '上午加餐', meal: '饮水并吃一份水果', portion: '400–500 毫升水 + 1 个苹果、橙子或梨' },
            { timing: '午餐', meal: '鸡肉、豆腐或豆类配糙米和混合蔬菜', portion: '1 掌心蛋白质 + 1 拳头米饭 + 2 拳头蔬菜' },
            { timing: '咖啡因', meal: '如有需要可喝咖啡或茶，之后改喝水或无咖啡因饮品', portion: '最多 1 杯，并在下午 2 点前喝完' },
          ]
        : [
            { timing: '早餐', meal: '全麦吐司配鸡蛋或豆腐和莓果', portion: '2 个鸡蛋或 150 克豆腐 + 2 片吐司 + 1 杯莓果' },
            { timing: '中午', meal: '午餐以蛋白质、谷物和蔬菜为主，并补充水分', portion: '500 毫升水 + 1 掌心蛋白质 + 1 拳头谷物 + 2 拳头蔬菜' },
            { timing: '下午', meal: '饿时可选择原味酸奶，或鹰嘴豆泥配胡萝卜', portion: '150 克酸奶或 3 汤匙鹰嘴豆泥 + 蔬菜' },
            { timing: '晚上', meal: '晚餐清淡并在睡前较早时间吃完', portion: '1 掌心蛋白质 + 蔬菜；避免饮酒和太晚的大餐' },
          ],
      movementPlan: sleptLessThanSevenHours
        ? {
            activity: '日间散步与活动度恢复', durationMinutes: 25, intensity: '轻松：应能完整说话', timing: '上午或下午早些时候接触自然光',
            warmUp: [{ name: '轻松步行', durationMinutes: 3, instruction: '慢慢走，让肩膀放松。' }, { name: '关节环绕', durationMinutes: 2, instruction: '每个方向缓慢绕肩 5 次，每侧绕脚踝 5 次。' }],
            workout: [{ name: '稳定的户外步行', durationMinutes: 12, instruction: '保持舒适步速，留意周围环境。' }, { name: '坐站练习', durationMinutes: 3, instruction: '使用稳固椅子缓慢站起、坐下，做 2 组，每组 6 次。' }],
            coolDown: [{ name: '小腿和胸部拉伸', durationMinutes: 3, instruction: '每侧轻柔保持 20–30 秒，不要勉强。' }, { name: '缓慢呼吸', durationMinutes: 2, instruction: '坐姿吸气 4 拍、呼气 6 拍。' }],
            lowerEnergyAlternative: '如果异常困倦，请跳过坐站练习，改为轻松走 10 分钟。困倦时不要开车或进行危险运动。',
          }
        : {
            activity: '快走与入门自重力量训练', durationMinutes: 35, intensity: '中等：呼吸加快但仍能短句交谈', timing: '在睡前至少 3 小时完成',
            warmUp: [{ name: '轻松步行', durationMinutes: 4, instruction: '自然摆臂，从轻松步伐开始。' }, { name: '动态活动', durationMinutes: 3, instruction: '做 8 次髋部折叠、每个方向 8 次绕臂和 8 次交替抬膝。' }],
            workout: [{ name: '快走', durationMinutes: 15, instruction: '选择能提高心率但不会喘不过气的速度。' }, { name: '自重循环', durationMinutes: 8, instruction: '完成 2 轮：8 次椅子深蹲、6 次墙壁俯卧撑和每侧 8 次站姿侧抬腿。' }],
            coolDown: [{ name: '轻松步行', durationMinutes: 3, instruction: '逐渐放慢，而不是突然停止。' }, { name: '轻柔拉伸', durationMinutes: 2, instruction: '分别拉伸小腿、胸部和臀部约 20 秒。' }],
            lowerEnergyAlternative: '若感到疲惫，可改为轻松走 10 分钟并进行轻柔拉伸。出现头晕、胸痛或异常气短时应停止。',
          },
      mindset: '你不需要弥补今天少睡的每一分钟。温和地过好普通的一天，适时休息，并记得一个难熬的夜晚并不决定今晚。',
      tonight: '保持熟悉的睡前放松习惯。若难以入睡，安静休息而不要强迫自己；清醒一段时间后可在昏暗光线下做平静的活动。持续失眠或嗜睡影响安全时，请寻求专业建议。',
      source: 'local', createdAt: new Date().toISOString(),
    };
  }

  return {
    headline: sleptLessThanSevenHours
      ? `${name ? `${name}, ` : ''}a shorter night is hard, but it is not a failure.`
      : `${name ? `${name}, ` : ''}your ${hoursLabel} of rest is a useful foundation for today.`,
    foodPlan: sleptLessThanSevenHours
      ? [
          { timing: 'Within 1 hour of waking', meal: '1 bowl oatmeal with Greek yogurt, a banana, and a small handful of walnuts', portion: '1 bowl + 150 g yogurt + 1 banana + 20 g walnuts' },
          { timing: 'Mid-morning', meal: 'Water and one piece of fruit', portion: '400-500 ml water + 1 apple, orange, or pear' },
          { timing: 'Lunch', meal: 'Chicken, tofu, or beans with brown rice and mixed vegetables', portion: '1 palm protein + 1 fist rice + 2 fists vegetables' },
          { timing: 'Caffeine', meal: 'Coffee or tea only if wanted, then switch to water or decaf', portion: 'At most 1 regular cup; finish before 2 PM' },
        ]
      : [
          { timing: 'Breakfast', meal: 'Eggs or tofu on whole-grain toast with berries', portion: '2 eggs or 150 g tofu + 2 slices toast + 1 cup berries' },
          { timing: 'Midday', meal: 'Water with lunch built around protein, grains, and vegetables', portion: '500 ml water + 1 palm protein + 1 fist grains + 2 fists vegetables' },
          { timing: 'Afternoon', meal: 'Plain yogurt or hummus with carrots if hungry', portion: '150 g yogurt or 3 tbsp hummus + vegetables' },
          { timing: 'Evening', meal: 'Keep dinner lighter and finish it well before bed', portion: '1 palm protein + vegetables; avoid alcohol and large late meals' },
        ],
    movementPlan: sleptLessThanSevenHours
      ? {
          activity: 'Daylight walk and mobility reset',
          durationMinutes: 25,
          intensity: 'Easy: you should be able to speak in full sentences',
          timing: 'Morning or early afternoon daylight',
          warmUp: [
            { name: 'Easy walk', durationMinutes: 3, instruction: 'Walk slowly and let your shoulders relax.' },
            { name: 'Joint circles', durationMinutes: 2, instruction: 'Do 5 slow shoulder circles each way and 5 ankle circles per side.' },
          ],
          workout: [
            { name: 'Steady outdoor walk', durationMinutes: 12, instruction: 'Walk at a comfortable pace; keep your phone away and notice your surroundings.' },
            { name: 'Sit-to-stand', durationMinutes: 3, instruction: 'From a sturdy chair, stand and sit slowly for 2 sets of 6 repetitions, resting between sets.' },
          ],
          coolDown: [
            { name: 'Calf and chest stretch', durationMinutes: 3, instruction: 'Hold each stretch gently for 20-30 seconds per side; do not force the range.' },
            { name: 'Slow breathing', durationMinutes: 2, instruction: 'Inhale for 4 counts and exhale for 6 counts while seated.' },
          ],
          lowerEnergyAlternative: 'If you feel unusually sleepy, skip the sit-to-stands and take a 10-minute easy walk instead. Do not drive or do risky exercise while drowsy.',
        }
      : {
          activity: 'Brisk walk with beginner bodyweight strength',
          durationMinutes: 35,
          intensity: 'Moderate: breathing faster but still able to speak in short sentences',
          timing: 'Finish at least 3 hours before bedtime',
          warmUp: [
            { name: 'Easy walk', durationMinutes: 4, instruction: 'Start gently, swinging your arms naturally.' },
            { name: 'Dynamic mobility', durationMinutes: 3, instruction: 'Do 8 hip hinges, 8 arm circles each way, and 8 alternating knee lifts.' },
          ],
          workout: [
            { name: 'Brisk walk', durationMinutes: 15, instruction: 'Choose a pace that raises your heart rate without leaving you breathless.' },
            { name: 'Bodyweight circuit', durationMinutes: 8, instruction: 'Complete 2 rounds: 8 chair squats, 6 wall push-ups, and 8 standing side leg lifts per side. Rest as needed.' },
          ],
          coolDown: [
            { name: 'Easy walk', durationMinutes: 3, instruction: 'Slow down gradually rather than stopping abruptly.' },
            { name: 'Gentle stretches', durationMinutes: 2, instruction: 'Stretch calves, chest, and hips for about 20 seconds each.' },
          ],
          lowerEnergyAlternative: 'If you feel run-down, replace the circuit with 10 minutes of easy walking and gentle stretching. Stop for dizziness, chest pain, or unusual shortness of breath.',
        },
    mindset: 'You do not need to make up for every minute of sleep today. Aim for a kind, ordinary day, take breaks when needed, and remind yourself that one difficult night does not define tonight.',
    tonight: 'Keep a familiar wind-down routine. If sleep feels elusive, rest quietly instead of fighting it; get out of bed for a calm, dim-light activity if you are awake for a while. Seek clinical advice for persistent insomnia or sleepiness that affects safety.',
    source: 'local',
    createdAt: new Date().toISOString(),
  };
}

function isMealPlan(value: unknown): value is MealPlanItem[] {
  return Array.isArray(value) && value.length >= 2 && value.every((item) =>
    typeof item === 'object' && item !== null &&
    typeof (item as MealPlanItem).timing === 'string' &&
    typeof (item as MealPlanItem).meal === 'string' &&
    typeof (item as MealPlanItem).portion === 'string'
  );
}

function isMovementPlan(value: unknown): value is MovementPlan {
  return typeof value === 'object' && value !== null &&
    typeof (value as MovementPlan).activity === 'string' &&
    typeof (value as MovementPlan).durationMinutes === 'number' &&
    typeof (value as MovementPlan).intensity === 'string' &&
    typeof (value as MovementPlan).timing === 'string' &&
    isMovementSteps((value as MovementPlan).warmUp) &&
    isMovementSteps((value as MovementPlan).workout) &&
    isMovementSteps((value as MovementPlan).coolDown) &&
    typeof (value as MovementPlan).lowerEnergyAlternative === 'string';
}

function isMovementSteps(value: unknown): value is MovementStep[] {
  return Array.isArray(value) && value.length > 0 && value.every((step) =>
    typeof step === 'object' && step !== null &&
    typeof (step as MovementStep).name === 'string' &&
    typeof (step as MovementStep).durationMinutes === 'number' &&
    typeof (step as MovementStep).instruction === 'string'
  );
}

export function isStructuredRecommendation(value: unknown): value is DailyRecommendation {
  return typeof value === 'object' && value !== null &&
    typeof (value as DailyRecommendation).headline === 'string' &&
    isMealPlan((value as DailyRecommendation).foodPlan) &&
    isMovementPlan((value as DailyRecommendation).movementPlan) &&
    typeof (value as DailyRecommendation).mindset === 'string' &&
    typeof (value as DailyRecommendation).tonight === 'string';
}

export async function generateDailyRecommendation(
  { session, profile, recentSessions = [], language = 'en' }: RecommendationContext
): Promise<DailyRecommendation> {
  const fallback = getLocalRecommendation(session, profile, language);

  if (!RECOMMENDATION_API_URL) {
    return { ...fallback, fallbackReason: 'No recommendation gateway URL was included in this app build.' };
  }

  try {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), GEMINI_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(
        `${RECOMMENDATION_API_URL.replace(/\/$/, '')}/v1/recommendations`,
        {
          method: 'POST',
          signal: abortController.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session, profile, recentSessions: recentSessions.slice(-7), language }),
        }
      );

      if (!response.ok) {
        return { ...fallback, fallbackReason: `Recommendation gateway returned HTTP ${response.status}.` };
      }

      const result = (await response.json()) as RecommendationGatewayResponse;
      const recommendation = isStructuredRecommendation(result.recommendation) ? result.recommendation : null;

      return recommendation
        ? {
            ...recommendation,
            source: 'groq',
            createdAt: new Date().toISOString(),
            language,
            promptVersion: RECOMMENDATION_PROMPT_VERSION,
          }
        : { ...fallback, fallbackReason: result.error ?? 'The recommendation gateway returned an invalid plan.' };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError'
      ? `The recommendation gateway did not respond within ${GEMINI_REQUEST_TIMEOUT_MS / 1000} seconds.`
      : 'The device could not connect to the recommendation gateway.';
    return { ...fallback, fallbackReason: reason };
  }
}
