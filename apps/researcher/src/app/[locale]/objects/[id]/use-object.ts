import {create} from 'zustand';
import {Organization} from '@p-322/api';
import {HeritageObjectEnrichment} from '@p-322/enricher';

interface State {
  organization?: Organization;
  objectId: string;
  locale: string;
  enrichments: HeritageObjectEnrichment[];
}

export default create<State>(() => ({
  organization: undefined,
  objectId: '',
  locale: '',
  enrichments: [],
}));
