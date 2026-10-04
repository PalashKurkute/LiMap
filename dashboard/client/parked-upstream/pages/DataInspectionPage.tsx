import React from 'react';
import type { SceneId, TelemetryResponse } from '../types/telemetry';
import { DataInspectionScreen } from '../components/DataInspectionScreen';

interface DataInspectionPageProps {
  activeScene: SceneId;
  telemetryData: TelemetryResponse | null;
  onBackToHome: () => void;
  onSelectScene?: (sceneId: SceneId) => void;
  isWalkthroughOpen?: boolean;
  onOpenWalkthrough?: () => void;
  onCloseWalkthrough?: () => void;
}

export const DataInspectionPage: React.FC<DataInspectionPageProps> = ({
  activeScene,
  telemetryData,
  onBackToHome,
  onSelectScene,
  isWalkthroughOpen,
  onOpenWalkthrough,
  onCloseWalkthrough,
}) => {
  return (
    <div className="w-full h-full flex flex-col flex-1 overflow-hidden relative">
      <DataInspectionScreen
        activeScene={activeScene}
        telemetryData={telemetryData}
        onBackToHook={onBackToHome}
        onSelectScene={onSelectScene}
        isWalkthroughOpen={isWalkthroughOpen}
        onOpenWalkthrough={onOpenWalkthrough}
        onCloseWalkthrough={onCloseWalkthrough}
      />
    </div>
  );
};
