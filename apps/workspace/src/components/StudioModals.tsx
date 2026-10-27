import React from 'react';
import { CatalogItem, CatalogRecommendation, Project } from '../types';
import { HybridSearchHit } from '../utils/recommenderEngine';
import { PlatformDomainId, PlatformDomainPreset } from '../data/domainDatabases';
import { ApiConsoleModal } from './ApiConsoleModal';
import { CsvImporterModal } from './CsvImporterModal';
import { DatabaseConnectorModal } from './DatabaseConnectorModal';

export interface StudioModalsProps {
  isApiModalOpen: boolean;
  onCloseApiModal: () => void;
  isCsvModalOpen: boolean;
  onCloseCsvModal: () => void;
  isDbConnectorOpen: boolean;
  onCloseDbConnector: () => void;
  catalog: CatalogItem[];
  selectedItem: CatalogItem | null;
  activeDomain: PlatformDomainId;
  csvProject: Project;
  onHybridSearch: (query: string, alpha: number, limit?: number) => Promise<HybridSearchHit[]>;
  onRecommend: (
    itemId: string,
    diversityLambda?: number,
    limit?: number
  ) => CatalogRecommendation[];
  onImportCsvConcepts: (
    concepts: Array<{ name: string; category?: string; notes?: string }>,
    replace: boolean
  ) => void;
  onSelectDomainPreset: (preset: PlatformDomainPreset) => void;
  onImportCustomDatabase: (items: CatalogItem[], label?: string) => void;
  onShowToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export const StudioModals: React.FC<StudioModalsProps> = ({
  isApiModalOpen,
  onCloseApiModal,
  isCsvModalOpen,
  onCloseCsvModal,
  isDbConnectorOpen,
  onCloseDbConnector,
  catalog,
  selectedItem,
  activeDomain,
  csvProject,
  onHybridSearch,
  onRecommend,
  onImportCsvConcepts,
  onSelectDomainPreset,
  onImportCustomDatabase,
  onShowToast,
}) => {
  return (
    <>
      <ApiConsoleModal
        isOpen={isApiModalOpen}
        onClose={onCloseApiModal}
        catalog={catalog}
        selectedItem={selectedItem}
        onHybridSearch={onHybridSearch}
        onGetRecommendations={async (item, diversity, limit) =>
          onRecommend(String(item.id), diversity, limit)
        }
      />

      <CsvImporterModal
        isOpen={isCsvModalOpen}
        project={csvProject}
        onClose={onCloseCsvModal}
        onImportConcepts={onImportCsvConcepts}
        onShowToast={onShowToast}
      />

      <DatabaseConnectorModal
        isOpen={isDbConnectorOpen}
        activeDomain={activeDomain}
        catalogCount={catalog.length}
        onClose={onCloseDbConnector}
        onSelectDomainPreset={onSelectDomainPreset}
        onImportCustomDatabase={onImportCustomDatabase}
      />
    </>
  );
};
