// MD data has not yet been supplied for the current reactions.
function MDDB({ reactionLabel }) {
  return <DevelopmentPanel title={`${reactionLabel} · MD Database`} description="尚未导入可核验的 MD / AIMD 轨迹文件、系综参数或帧数据。" />;
}

Object.assign(window, { MDDB });
