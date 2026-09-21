<template>
  <div class="explorer">
<el-alert
  title="数据展示与检索说明"
  type="info"
  :closable="false"
>
  <template #default>
    <div class="data-description">
      <div>1. 数据源：catalyst_platform.sqlite。</div>
      <div>
        2. 有效条目指存在数值或有效文字值的反应特征记录；错误单元格、N/A 与空值不计入。
      </div>
      <div>
        3. 当前平台按照 CO氧化、C3H6氧化和NH3-SCR 三类反应组织数据，并支持按催化剂及特征细分进行检索。
      </div>
    </div>
  </template>
</el-alert>
    <el-row :gutter="12" class="cards">
      <el-col :span="8" v-for="r in summary?.reactions || []" :key="r.id">
        <el-card class="reaction-card" :class="{ active: reaction === r.id }" @click="reaction = r.id">
          <strong>{{ r.name_zh }}</strong>
          <div>{{ r.catalystCount }} 种催化剂 · {{ r.validFeatureCount.toLocaleString() }} 条有效数据条目</div>
          <small>{{ r.kmcSegmentCount }} 个 kMC 数据段，其中 {{ r.kmcPopulatedCount }} 个含模拟配置</small>
        </el-card>
      </el-col>
    </el-row>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-alert v-if="!editable" title="当前为静态浏览模式。要编辑本机 SQLite，请在项目目录运行 py -3 scripts/serve-local.py（Linux/macOS：python3 scripts/serve-local.py）。" type="warning" :closable="false" />
    <section v-loading="loading" v-if="payload" class="data-panels">
      <!-- 催化剂特征 -->
      <el-card class="block">
        <template #header><strong>催化剂特征</strong></template>
        <div class="filters">
          <el-select v-model="selectedCatalysts" multiple filterable clearable collapse-tags placeholder="选择催化剂" style="width:260px" @change="limitCatalysts">
            <el-option v-for="c in payload.catalysts" :key="c.id" :label="c.display_name || c.catalyst_id" :value="c.id" />
          </el-select>
          <el-select v-model="catalystGroup" placeholder="细分类别" style="width:220px">
            <el-option v-for="g in catalystGroups" :key="g" :label="g" :value="g" />
          </el-select>
          <el-select v-model="featureName" filterable clearable placeholder="特征名称" style="width:320px">
            <el-option v-for="n in catalystNames" :key="n" :label="n" :value="n" />
          </el-select>
        </div>
        <el-table :data="catalystFeatures.slice(0,200)" stripe height="350" size="small">
          <el-table-column prop="feature_group" label="类别" width="130" />
          <el-table-column prop="feature_name" label="指标" min-width="300" />
          <el-table-column label="数值" width="150"><template #default="{row}">{{formatValue(row.value_num ?? row.value_text)}}</template></el-table-column>
          <el-table-column prop="unit" label="单位" width="90" />
        </el-table>

      </el-card>

      <!-- 反应参数 -->
      <el-card class="block">
        <template #header><strong>反应参数</strong></template>
        <div class="filters">
          <el-select v-model="reactionCatalysts" multiple filterable clearable collapse-tags placeholder="选择催化剂" style="width:260px" @change="limitReactionCatalysts">
            <el-option v-for="c in payload.catalysts" :key="c.id" :label="c.display_name || c.catalyst_id" :value="c.id" />
          </el-select>
          <el-select v-model="reactionGroup" placeholder="细分类别" style="width:220px">
            <el-option v-for="g in reactionGroups" :key="g" :label="g" :value="g" />
          </el-select>
          <el-select v-model="reactionFeatureName" filterable clearable placeholder="反应参数" style="width:320px">
            <el-option v-for="n in reactionNames" :key="n" :label="n" :value="n" />
          </el-select>
          <el-select v-model="reactionTemperature" clearable placeholder="温度(K)" style="width:140px">
            <el-option v-for="t in reactionTemperatures" :key="t" :label="`${t} K`" :value="t" />
          </el-select>
        </div>
        <el-table :data="reactionFeatures.slice(0,200)" stripe height="350" size="small">
          <el-table-column prop="feature_group" label="类别" width="130" />
          <el-table-column prop="feature_name" label="反应能量/虚频" min-width="300" />
          <el-table-column label="数值" width="150"><template #default="{row}">{{formatValue(row.value_num ?? row.value_text)}}</template></el-table-column>
          <el-table-column prop="unit" label="单位" width="90" />
        </el-table>
      </el-card>

      <!-- 动力学参数 -->
      <el-card class="block">
        <template #header><strong>动力学参数</strong></template>
        <div class="filters">
          <el-select 
            v-model="kmcCatalysts" 
            multiple 
            filterable 
            clearable 
            collapse-tags 
            placeholder="选择催化剂" 
            style="width:260px" 
            @change="limitKmcCatalysts"
          >
            <el-option 
              v-for="c in payload.catalysts" 
              :key="c.id" 
              :label="c.display_name || c.catalyst_id" 
              :value="c.id" 
            />
          </el-select>

          <el-select
            v-model="kmcTemperature"
            clearable
            filterable
            placeholder="选择温度"
            style="width:180px"
          >
            <el-option
              v-for="t in kmcTemperatures"
              :key="t"
              :value="t"
              :label="`${t} K`"
            />
          </el-select>

          <el-select 
            v-model="segmentIndex" 
            filterable 
            placeholder="选择kMC数据段" 
            style="width:420px"
          >
            <el-option 
              v-for="(s,i) in segmentsForSelectionKMC" 
              :key="s.id" 
              :value="i" 
              :label="s.temperature_K != null ? `${s.temperature_K} K · segment-${s.id}` : `segment-${s.id}`" 
            />
          </el-select>
        </div>
        <div class="kinetic-caption" v-if="selectedSegment">
          当前数据段：{{ selectedSegment.catalyst_id }}<span v-if="selectedSegment.temperature_K != null"> · {{ selectedSegment.temperature_K }} K</span><span v-if="selectedSegment.feed"> · {{ selectedSegment.feed }}</span>
          · 共 {{ selectedSegment.configs?.length || 0 }} 个配置
        </div>
        <el-table :data="selectedSegment?.configs || []" stripe height="260" size="small" highlight-current-row @row-click="selectKmcConfig">
          <el-table-column prop="configuration" label="配置" />
          <el-table-column prop="steps" label="模拟步数" />
          <el-table-column label="总速率">
            <template #default="{row}">
              {{ formatKineticValue(row.overall_rate) }}
            </template>
          </el-table-column>
        </el-table>
        <el-divider content-position="left">各步骤正逆反应事件频率统计</el-divider>
        <div class="kinetic-caption">当前配置：{{ selectedConfig?.configuration ?? '—' }}；模拟步数：{{ selectedConfig?.steps ?? '—' }}</div>
        <el-table :data="eventFrequencySummary" stripe height="300" size="small" v-loading="eventsLoading">
          <el-table-column prop="name" label="反应步骤" min-width="300" />
          <el-table-column label="正向频率" min-width="130"><template #default="{row}">{{ formatKineticValue(row.forwardRate) }}</template></el-table-column>
          <el-table-column label="逆向频率" min-width="130"><template #default="{row}">{{ formatKineticValue(row.reverseRate) }}</template></el-table-column>
          <el-table-column label="正向次数" width="110"><template #default="{row}">{{ row.forwardCount ?? '—' }}</template></el-table-column>
          <el-table-column label="逆向次数" width="110"><template #default="{row}">{{ row.reverseCount ?? '—' }}</template></el-table-column>
        </el-table>
        <el-table :data="currentEvents" stripe height="260" size="small" v-loading="eventsLoading">
          <el-table-column prop="event_name" label="反应步骤" min-width="260" />
          <el-table-column label="方向" width="100">
            <template #default="{row}">
              {{ getEventDirection(row.event_name) }}
            </template>
          </el-table-column>
          <el-table-column label="事件频率">
            <template #default="{row}">
              {{ formatKineticValue(row.rate) }}
            </template>
          </el-table-column>
          <el-table-column prop="event_count" label="发生次数" />
        </el-table>
      </el-card>
    </section>
    <el-dialog v-model="editorVisible" :title="editingId ? '编辑特征记录' : '新增特征记录'" width="min(600px,95vw)" destroy-on-close>
      <el-form :model="form" label-width="115px">
        <el-form-item label="催化剂"><el-select v-model="form.catalyst_id" filterable :disabled="!!editingId" style="width:100%"><el-option v-for="c in payload?.catalysts || []" :key="c.id" :label="c.display_name || c.catalyst_id" :value="c.id" /></el-select></el-form-item>
        <el-form-item label="特征类别"><el-select v-model="form.feature_group" style="width:100%"><el-option v-for="g in editableGroups" :key="g" :value="g" :label="g" /></el-select></el-form-item>
        <el-form-item label="指标名称"><el-input v-model="form.feature_name" /></el-form-item>
        <el-form-item label="数值"><el-input v-model="form.value_num" placeholder="数值与文字值二选一" /></el-form-item>
        <el-form-item label="文字值"><el-input v-model="form.value_text" placeholder="数值与文字值二选一" /></el-form-item>
        <el-form-item label="单位"><el-input v-model="form.unit" /></el-form-item>
        <el-form-item label="温度 (K)"><el-input v-model="form.temperature_K" placeholder="可留空" /></el-form-item>
      </el-form>
      <el-alert v-if="editingScope === 'global'" type="warning" :closable="false" title="这是全局特征；修改后会影响该催化剂关联的所有反应页面。" />
      <template #footer><el-button @click="editorVisible=false">取消</el-button><el-button type="primary" :loading="saving" @click="saveFeature">保存到 SQLite</el-button></template>
    </el-dialog>
  </div>
</template>


<script setup>
const reactionStatistics = {
  co: {
    catalyst: 186,
    catalystFeature: 19814,
    reactionParameter: 2523,
    kmc: 3846
  },
  c3h6: {
    catalyst: '—',
    catalystFeature: 1786,
    reactionParameter: 2049,
    kmc: 22
  },
  nh3: {
    catalyst: 20,
    catalystFeature: 3897,
    reactionParameter: 3049,
    kmc: 3618
  }
}

import { ref, computed, watch, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
const summary = ref(null), payload = ref(null), reaction = ref('co'), loading = ref(false), error = ref('');
const selectedCatalysts = ref([]), category = ref('催化剂特征'), group = ref(''), featureName = ref(''), temperature = ref(null), segmentIndex = ref(0);
const editable = ref(false), editorVisible = ref(false), editingId = ref(null), editingScope = ref(''), saving = ref(false);
const form = ref({}), selectedConfigId = ref(null), kmcEvents = ref([]), eventsLoading = ref(false);
const BASE = `${import.meta.env.BASE_URL}data/`;
// 数值展示格式化：统一保留小数点后两位
const formatValue = (value) => {

  if (value === null || value === undefined || value === '') {
    return '—'
  }

  const num = Number(value)

  if (Number.isNaN(num)) {
    return value
  }

  return num.toFixed(2)

}

// 动力学参数展示：科学计数法
const formatKineticValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  const num = Number(value)

  if (Number.isNaN(num)) {
    return value
  }

  return num.toExponential(2)
}

// 根据kMC事件名称识别正/逆反应方向
const getEventDirection = (eventName) => {
  if (!eventName) return '—'
  if (/_fwd$/i.test(eventName) || /_forward$/i.test(eventName)) return '正向'
  if (/_rev$/i.test(eventName) || /_reverse$/i.test(eventName)) return '逆向'
  return '—'
}

onMounted(async () => {
  try { const status = await (await fetch('/api/status')).json(); editable.value = status.editable === true; } catch { editable.value = false; }
  try { const r = await fetch(`${BASE}summary.json`); if (!r.ok) throw Error(`HTTP ${r.status}`); summary.value = await r.json(); reaction.value = summary.value.reactions[0]?.id || 'co'; }
  catch (e) { error.value = `SQLite 导出数据未找到：${e.message}。请运行 npm run export:sqlite。`; }
});
async function loadReaction(id, reset = false) {
  payload.value = null; loading.value = true; error.value = '';
  if (reset) { selectedCatalysts.value = []; category.value = '催化剂特征'; group.value = ''; featureName.value = ''; temperature.value = null; segmentIndex.value = 0; }
  try { const r = await fetch(`${BASE}${id}.json?v=${Date.now()}`, {cache:'no-store'}); if (!r.ok) throw Error(`HTTP ${r.status}`); payload.value = await r.json(); }
  catch (e) { error.value = `读取 ${id} 数据失败：${e.message}`; }
  finally { loading.value = false; }
}
watch(reaction, id => loadReaction(id, true), { immediate: true });
const catalystMap = computed(() => new Map((payload.value?.catalysts || []).map(c => [c.id, c])));
const editableGroups = ['元素/基础属性','结构特征','电子结构'];
const catalystGroup = ref('元素/基础属性');
const catalystGroups = ['元素/基础属性','结构特征','电子结构'];
const catalystFeatures = computed(() => (payload.value?.features || []).filter(f =>
  catalystGroups.includes(f.feature_group) &&
  f.feature_group === catalystGroup.value &&
  (!selectedCatalysts.value.length || selectedCatalysts.value.includes(f.catalyst_id)) &&
  (!featureName.value || f.feature_name === featureName.value)
));
const catalystNames = computed(() => [...new Set(catalystFeatures.value.map(f=>f.feature_name))].sort());
const categoryMap = {
  '催化剂特征': ['元素/基础属性','结构特征','电子结构'],
  '反应参数': ['反应能量','过渡态虚频'],
  '动力学参数': ['kMC模拟数据']
};
const categories = ['催化剂特征','反应参数','动力学参数'];
const groups = computed(() => [...new Set([...editableGroups,'反应能量','过渡态虚频','kMC模拟数据',...(payload.value?.features || []).map(f => f.feature_group).filter(Boolean)])]);
const subGroups = computed(() => categoryMap[category.value] || groups.value);
const names = computed(() => [...new Set((payload.value?.features || []).filter(f => !group.value || f.feature_group === group.value).map(f => f.feature_name))].sort());
const temperatures = computed(() => [...new Set((payload.value?.features || []).map(f => f.temperature_K).filter(t => t != null))].sort((a, b) => a - b));
watch(category, () => { 
  group.value = categoryMap[category.value]?.[0] || '';
  featureName.value = '';
});
watch(group, () => { featureName.value = ''; });
function limitCatalysts(v) { if (v.length > 3) selectedCatalysts.value = v.slice(0, 3); segmentIndex.value = 0; }
function limitReactionCatalysts(v) { if (v.length > 3) reactionCatalysts.value = v.slice(0, 3); }
function limitKmcCatalysts(v) { if (v.length > 3) kmcCatalysts.value = v.slice(0, 3); kmcTemperature.value = null; segmentIndex.value = 0; }
const reactionGroup = ref('反应能量'), reactionFeatureName = ref('');
const reactionCatalysts = ref([]), kmcCatalysts = ref([]), reactionTemperature = ref(null), kmcTemperature = ref(null);
const reactionGroups = ['反应能量','过渡态虚频'];
const reactionFeatures = computed(() => (payload.value?.features || []).filter(f => f.feature_group === reactionGroup.value && (!reactionFeatureName.value || f.feature_name === reactionFeatureName.value) && (!reactionCatalysts.value.length || reactionCatalysts.value.includes(f.catalyst_id)) && (reactionTemperature.value == null || f.temperature_K === reactionTemperature.value)));
const reactionTemperatures = computed(() => [...new Set((payload.value?.features || []).filter(f=>f.feature_group===reactionGroup.value).map(f=>f.temperature_K).filter(t=>t!=null))].sort((a,b)=>a-b));
const reactionNames = computed(() => [...new Set((payload.value?.features || []).filter(f => f.feature_group === reactionGroup.value).map(f => f.feature_name))].sort());

const filteredFeatures = computed(() => (payload.value?.features || []).filter(f =>
  (!selectedCatalysts.value.length || selectedCatalysts.value.includes(f.catalyst_id)) &&
  (!group.value || f.feature_group === group.value) &&
  (!featureName.value || f.feature_name === featureName.value) &&
  (temperature.value == null || temperature.value === '' || f.temperature_K === temperature.value)));
const segmentsForSelection = computed(() => (payload.value?.segments || []).filter(s =>
  !selectedCatalysts.value.length || selectedCatalysts.value.includes(s.catalyst_id)));
const segmentsForSelectionKMC = computed(() => (payload.value?.segments || []).filter(s =>
  (!kmcCatalysts.value.length || kmcCatalysts.value.includes(s.catalyst_id)) && (kmcTemperature.value == null || s.temperature_K === kmcTemperature.value)));
const kmcTemperatures = computed(() => [...new Set(
  (payload.value?.segments || [])
    .filter(s => !kmcCatalysts.value.length || kmcCatalysts.value.includes(s.catalyst_id))
    .map(s=>s.temperature_K)
    .filter(t=>t!=null)
)].sort((a,b)=>a-b));
const selectedSegment = computed(() => segmentsForSelectionKMC.value[segmentIndex.value] || null);
const selectedConfig = computed(() => (selectedSegment.value?.configs || []).find(c => c.id === selectedConfigId.value) || selectedSegment.value?.configs?.at(-1) || null);
function selectKmcConfig(row) { selectedConfigId.value = row.id; }
watch(segmentsForSelection, () => { segmentIndex.value = 0; });
const currentEvents = computed(() => kmcEvents.value.filter(e => e.config_id === selectedConfigId.value));

const eventFrequencySummary = computed(() => {
  const map = new Map()
  currentEvents.value.forEach(e => {
    const name = (e.event_name || '').replace(/_(fwd|rev)$/i, '')
    if (!map.has(name)) {
      map.set(name, {name, forwardRate: null, reverseRate: null, forwardCount: null, reverseCount: null})
    }
    const item = map.get(name)
    if (/_fwd$/i.test(e.event_name || '')) { item.forwardRate = e.rate; item.forwardCount = e.event_count }
    else if (/_rev$/i.test(e.event_name || '')) { item.reverseRate = e.rate; item.reverseCount = e.event_count }
  })
  return Array.from(map.values())
});
watch([selectedSegment, category], async ([segment, currentCategory]) => {
  kmcEvents.value = [];

  // 默认选择当前kMC数据段最后一个配置
  selectedConfigId.value = segment?.configs?.at(-1)?.id ?? null;

  // 仅动力学参数模块加载kMC事件
  if (currentCategory !== '动力学参数' || !segment?.configs?.length) return;

  eventsLoading.value = true;

  try {
    const r = await fetch(`${BASE}kmc/${segment.id}.json?v=${Date.now()}`);
    if (!r.ok) throw Error(`HTTP ${r.status}`);
    kmcEvents.value = await r.json();
  }
  catch (e) {
    ElMessage.error(`kMC 事件读取失败：${e.message}`);
  }
  finally {
    eventsLoading.value = false;
  }
});
function openEditor(row) {
  editingId.value = row?.id ?? null; editingScope.value = row?.scope || '';
  form.value = row ? {catalyst_id:row.catalyst_id,feature_group:row.feature_group,feature_name:row.feature_name,value_num:row.value_num ?? '',value_text:row.value_text ?? '',unit:row.unit ?? '',temperature_K:row.temperature_K ?? ''}
    : {catalyst_id:selectedCatalysts.value[0] ?? payload.value?.catalysts[0]?.id,feature_group:'反应能量',feature_name:'',value_num:'',value_text:'',unit:'',temperature_K:''};
  editorVisible.value = true;
}
async function requestMutation(method, id, body) {
  const response = await fetch(`/api/features${id ? '/' + id : ''}`, {method,headers: body ? {'Content-Type':'application/json'} : {}, body: body ? JSON.stringify(body) : undefined});
  const result = await response.json();
  if (!response.ok) throw Error(result.error || `HTTP ${response.status}`);
  const s = await fetch(`${BASE}summary.json?v=${Date.now()}`, {cache:'no-store'}); summary.value = await s.json();
  await loadReaction(reaction.value);
}
async function saveFeature() {
  saving.value = true;
  try { await requestMutation(editingId.value ? 'PATCH':'POST',editingId.value,{...form.value,reaction_id:editingScope.value === 'global' ? null : reaction.value}); editorVisible.value=false; ElMessage.success('已写入 SQLite'); }
  catch (e) { ElMessage.error(e.message); }
  finally { saving.value=false; }
}
async function deleteFeature(row) {
  try {
    await ElMessageBox.confirm(`确认删除“${row.feature_name}”的这条记录？${row.scope === 'global' ? '全局特征删除会影响关联反应。' : ''}`, '确认删除', {type:'warning'});
    await requestMutation('DELETE',row.id); ElMessage.success('已从 SQLite 删除');
  } catch(e) { if(e !== 'cancel') ElMessage.error(e.message); }
}
const chartPoints = computed(() => {
  const a = (selectedSegment.value?.configs || []).filter(x => Number.isFinite(x.steps) && Number.isFinite(x.overall_rate) && x.overall_rate > 0);
  if (!a.length) return '';
  const xs = a.map(x => x.steps), ys = a.map(x => Math.log10(x.overall_rate));
  const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  return a.map((x, i) => `${50 + (x.steps - xmin) / (xmax - xmin || 1) * 578},${162 - (ys[i] - ymin) / (ymax - ymin || 1) * 145}`).join(' ');
});
</script>


const currentStatistics = computed(() => {
  return reactionStatistics[selectedReaction?.value] || null
})

<style scoped>
.explorer { display: grid; gap: 14px; }.module-cards { margin-top: 2px; }.module-cards .el-card { min-height: 105px; }.module-cards div { margin: 8px 0 3px; color:#475467; }.module-cards small { color:#667085; }.cards { margin-top: 2px; }.reaction-card { cursor: pointer; min-height: 100px; }.reaction-card.active { border-color: #409eff; background: #ecf5ff; }
.toolbar-title { display:flex;justify-content:space-between;align-items:center; }
.reaction-card div { margin: 8px 0 3px; }.reaction-card small, .caption { color: #667085; }.data-panels { display:grid; grid-template-columns: repeat(2, minmax(420px,1fr)); gap:14px; align-items:start; }.data-panels > .block:nth-child(3) { grid-column: 1 / -1; }.block { margin-top: 2px; }.filters { display:flex; gap: 10px; flex-wrap:wrap; margin-bottom: 12px; }.caption, .kinetic-caption { font-size: 12px; margin: 10px 0; line-height:1.5; color:#667085; }.plot { width:100%; max-width:780px; display:block; margin:14px 0; }
.data-description {
  line-height: 1.8;
  font-size: 14px;
}

.data-description div {
  margin-bottom: 4px;
}

.statistics-panel{
  margin-top:12px;
  padding-top:10px;
  border-top:1px solid #d9e2ec;
}
.statistics-panel p{
  margin:4px 0;
}

</style>
