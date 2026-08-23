import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Elephant, ElephantType, Gender } from '../types/elephant';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Crown,
  Building2,
  RefreshCw,
  Info,
  Layers,
  Sparkles,
  UserCheck,
  CheckCheck,
  DatabaseZap,
  HelpCircle,
  X,
  Play,
  Settings,
  Terminal,
  Heart,
  Wrench,
  ChevronRight,
  Check
} from 'lucide-react';
import { Language } from '../utils/translations';
import { compressBase64Image } from '../utils/imageCompressor';
import { db } from '../firebase/config';
import { doc, writeBatch, serverTimestamp, setDoc } from 'firebase/firestore';

interface BulkImportElephantsProps {
  existingElephants: Elephant[];
  onSaveElephant: (elephant: Omit<Elephant, 'id' | 'createdAt' | 'updatedAt'>, id?: string, skipRefresh?: boolean) => Promise<void>;
  onSaveElephantsBatch?: (operations: { data: Omit<Elephant, 'id' | 'createdAt' | 'updatedAt'>; id?: string; }[]) => Promise<void>;
  language: Language;
  onFinished: () => void;
}

interface ParsedElephantRow {
  id?: string;
  name: string;
  sinhalaName: string;
  otherNames: string[];
  gender: Gender;
  type: ElephantType;
  age: string | number;
  dateOfBirth: string;
  location: string;
  organization: string;
  mahout: string;
  tusks: string;
  physicalCharacteristics: string;
  description: string;
  peraheraParticipation: string[];
  photos: string[];
  status: 'living' | 'memorial';
  verified: boolean;
  isFeatured: boolean;
  isLive: boolean;
  customBadge: string;
  isValid: boolean;
  validationError?: string;
  isExistingMatch?: boolean;
  matchedElephant?: Elephant;
  matchedId?: string;
  missingFieldsToFill?: string[];
}

const DEFAULT_SAMPLE_PHOTOS = [
  'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1581852017103-68ac65514cf7?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1549366021-9f761d450615?auto=format&fit=crop&w=1200&q=80'
];

function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\-_.,/()'"[\]:;]+/g, '');
}

function isMissingOrPlaceholder(val: any): boolean {
  if (val === undefined || val === null) return true;
  if (typeof val === 'number') return isNaN(val) || val === 0;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return (
      s === '' ||
      s === 'n/a' ||
      s === 'null' ||
      s === 'undefined' ||
      s === 'none' ||
      s === 'unknown' ||
      s === '-' ||
      s === 'no' ||
      s === 'sri lanka' ||
      s === 'national custodians' ||
      s.includes('sri lankan domesticated elephant')
    );
  }
  if (Array.isArray(val)) {
    return val.length === 0;
  }
  return false;
}

export function BulkImportElephants({
  existingElephants,
  onSaveElephant,
  onSaveElephantsBatch,
  language,
  onFinished,
}: BulkImportElephantsProps) {
  // Wizard steps: '1_upload' | '2_preview' | '3_importing'
  const [step, setStep] = useState<'1_upload' | '2_preview' | '3_importing'>('1_upload');
  
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedElephantRow[]>([]);
  
  // Controls
  const [importMode, setImportMode] = useState<'smart_merge' | 'overwrite_all' | 'add_only'>('smart_merge');
  const [autoVerifyAll, setAutoVerifyAll] = useState(true);
  const [previewSearch, setPreviewSearch] = useState('');

  // Execution State
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    success: number;
    failed: number;
  } | null>(null);
  const [importLogs, setImportLogs] = useState<{ type: 'info' | 'success' | 'warn' | 'error'; text: string; time: string }[]>([]);
  const [importComplete, setImportComplete] = useState(false);
  const [lastFirestoreError, setLastFirestoreError] = useState<{ code: string; message: string; phase: string } | null>(null);

  // Connection Test State
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; code?: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<boolean>(false);

  const addLog = (text: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setImportLogs((prev) => [...prev, { type, text, time }]);
  };

  const handleCancelImport = () => {
    cancelRef.current = true;
    addLog(
      language === 'si' ? '⚠️ පරිශීලකයා විසින් දත්ත ඇතුළත් කිරීම අවලංගු කරන ලදී.' : '⚠️ Import cancelled by the user.',
      'warn'
    );
  };

  // -------------------------------------------------------------
  // TEMPLATES & EXPORTS
  // -------------------------------------------------------------
  const sampleTemplateData = [
    {
      'Elephant Name': 'Nadungamuwa Raja',
      'Sinhala Name': 'නැදුන්ගමුව විජය රාජා',
      'Other Names': 'Nadungamuwa Raja, Millenium Raja',
      'Type (tusker/elephant)': 'tusker',
      'Gender (male/female)': 'male',
      'Age': 68,
      'Date of Birth': '1953',
      'Location': 'Gampaha (ගම්පහ)',
      'Organization / Temple': 'Dr. Harsha Dharmavijeya (පුද්ගලික හිමිකරු)',
      'Mahout': 'Wilson Kody (විල්සන් කොඩි)',
      'Tusks Details': 'දිගු සවිමත් යුගල දළ (Twin majestic tusks)',
      'Physical Characteristics': 'උස අඩි 10.5, තේජවන්ත පෙනුම, පුළුල් කුම්භස්ථලය',
      'Description': 'ශ්‍රී ලංකාවේ වැඩිම වාර ගණනක් දළදා මාලිගාවේ පෙරහැරේ කරඬුව වැඩමවූ අතිපූජනීය හස්තිරාජයා.',
      'Perahera Participation': 'Kandy Esala Perahera, Kelaniya Duruthu Perahera',
      'Photos (URLs comma separated)': 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80',
      'Status (living/memorial)': 'memorial',
      'Verified (TRUE/FALSE)': 'TRUE',
      'Featured (TRUE/FALSE)': 'TRUE',
      'LIVE (TRUE/FALSE)': 'FALSE',
      'Custom Badge': 'Sacred Casket Bearer',
    },
    {
      'Elephant Name': 'Myan Kumara',
      'Sinhala Name': 'මියන් කුමාර',
      'Other Names': 'Burma Kumara, Myanmar Kumara',
      'Type (tusker/elephant)': 'tusker',
      'Gender (male/female)': 'male',
      'Age': 30,
      'Date of Birth': '1994',
      'Location': 'Kandy',
      'Organization / Temple': 'Sri Dalada Maligawa (ශ්‍රී දළදා මාළිගාව)',
      'Mahout': 'Maligawa Mahouts',
      'Tusks Details': 'සවිමත් තේජාන්විත දළ යුගල (Parallel tusks)',
      'Physical Characteristics': 'උස අඩි 9.4, දේහ සම්පන්න තේජවන්ත පෙනුම',
      'Description': 'ශ්‍රී දළදා මාළිගාවේ පෙරහැර කටයුතු සඳහා දායක වන ප්‍රධාන ඇත් රජෙකි.',
      'Perahera Participation': 'Kandy Esala Perahera, Kelaniya Duruthu Perahera',
      'Photos (URLs comma separated)': 'https://images.unsplash.com/photo-1581852017103-68ac65514cf7?auto=format&fit=crop&w=1200&q=80',
      'Status (living/memorial)': 'living',
      'Verified (TRUE/FALSE)': 'TRUE',
      'Featured (TRUE/FALSE)': 'TRUE',
      'LIVE (TRUE/FALSE)': 'FALSE',
      'Custom Badge': 'Temple Tusker',
    }
  ];

  const handleDownloadExcelTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(sampleTemplateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Elephants_Template');
    XLSX.writeFile(wb, 'alimedia_elephants_bulk_template.xlsx');
  };

  const handleDownloadCSVTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(sampleTemplateData);
    const csvOutput = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alimedia_elephants_bulk_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // -------------------------------------------------------------
  // INTELLIGENT MATCHING HELPER
  // -------------------------------------------------------------
  const findMatchingElephant = (name: string, sinhalaName: string, otherNames: string[] = []): Elephant | undefined => {
    const normName = normalizeText(name);
    const normSinhala = normalizeText(sinhalaName);
    const normOthers = otherNames.map(normalizeText).filter(Boolean);

    if (!normName && !normSinhala) return undefined;

    for (const el of existingElephants) {
      const elNameNorm = normalizeText(el.name);
      const elSinhalaNorm = normalizeText(el.sinhalaName);
      const elOtherNorms = (el.otherNames || []).map(normalizeText).filter(Boolean);

      // Match against primary names
      if (normName && (normName === elNameNorm || normName === elSinhalaNorm)) return el;
      if (normSinhala && (normSinhala === elSinhalaNorm || normSinhala === elNameNorm)) return el;

      // Match against Other Names
      if (normName && elOtherNorms.includes(normName)) return el;
      if (normSinhala && elOtherNorms.includes(normSinhala)) return el;

      for (const o of normOthers) {
        if (o === elNameNorm || o === elSinhalaNorm || elOtherNorms.includes(o)) {
          return el;
        }
      }

      // Containment checks for longer names
      if (normName.length >= 6 && elNameNorm.length >= 6) {
        if (normName.includes(elNameNorm) || elNameNorm.includes(normName)) return el;
      }
    }
    return undefined;
  };

  const computeMissingFieldsToFill = (existing: Elephant, row: Partial<ParsedElephantRow>): string[] => {
    const fields: string[] = [];
    if (isMissingOrPlaceholder(existing.sinhalaName) && !isMissingOrPlaceholder(row.sinhalaName)) {
      fields.push('Sinhala Name');
    }
    if (isMissingOrPlaceholder(existing.age) && !isMissingOrPlaceholder(row.age)) {
      fields.push('Age');
    }
    if (isMissingOrPlaceholder(existing.dateOfBirth) && !isMissingOrPlaceholder(row.dateOfBirth)) {
      fields.push('DOB');
    }
    if (isMissingOrPlaceholder(existing.mahout) && !isMissingOrPlaceholder(row.mahout)) {
      fields.push('Mahout');
    }
    if (isMissingOrPlaceholder(existing.tusks) && !isMissingOrPlaceholder(row.tusks)) {
      fields.push('Tusks');
    }
    if (isMissingOrPlaceholder(existing.organization) && !isMissingOrPlaceholder(row.organization)) {
      fields.push('Owner/Temple');
    }
    if (isMissingOrPlaceholder(existing.location) && !isMissingOrPlaceholder(row.location)) {
      fields.push('Location');
    }
    if (isMissingOrPlaceholder(existing.physicalCharacteristics) && !isMissingOrPlaceholder(row.physicalCharacteristics)) {
      fields.push('Physical Marks');
    }
    if (isMissingOrPlaceholder(existing.description) && !isMissingOrPlaceholder(row.description)) {
      fields.push('Biography');
    }
    return fields;
  };

  // -------------------------------------------------------------
  // PARSE FILE WORKBOOK
  // -------------------------------------------------------------
  const processWorkbook = (wb: XLSX.WorkBook) => {
    try {
      if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
        alert(language === 'si' ? 'Excel ගොනුවේ කිසිදු Sheet එකක් හමු නොවීය.' : 'No sheets found in workbook.');
        setIsParsing(false);
        return;
      }

      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const rawData: Record<string, any>[] = XLSX.utils.sheet_to_json(firstSheet, {
        defval: '',
        raw: false,
        dateNF: 'yyyy-mm-dd',
      });

      if (!rawData || rawData.length === 0) {
        alert(language === 'si' ? 'ගොනුවේ දත්ත පේළි කිසිවක් හමු නොවීය.' : 'No data rows found in the sheet.');
        setIsParsing(false);
        return;
      }

      const rows: ParsedElephantRow[] = rawData.map((rawRow, idx) => {
        const mapped: Record<string, any> = {};

        Object.entries(rawRow).forEach(([origKey, rawVal]) => {
          const val = typeof rawVal === 'string' ? rawVal.trim() : String(rawVal || '').trim();
          const normKey = normalizeText(origKey);

          if (normKey.includes('sinhala') || normKey.includes('සිංහල') || normKey === 'sinhalaname') {
            mapped.sinhalaName = val;
          } else if (normKey.includes('name') || normKey.includes('නම') || normKey === 'title' || normKey === 'elephantname') {
            if (!mapped.name) mapped.name = val;
          } else if (normKey.includes('other') || normKey.includes('alias') || normKey.includes('වෙනත්')) {
            mapped.otherNames = val;
          } else if (normKey.includes('type') || normKey.includes('වර්ගය') || normKey.includes('කුලය')) {
            mapped.type = val.toLowerCase();
          } else if (normKey.includes('gender') || normKey.includes('ලිංගය') || normKey.includes('sex')) {
            mapped.gender = val.toLowerCase();
          } else if (normKey === 'age' || normKey.includes('වයස') || normKey.includes('අවුරුදු')) {
            mapped.age = val;
          } else if (normKey.includes('birth') || normKey.includes('dob') || normKey.includes('උපන්')) {
            mapped.dateOfBirth = val;
          } else if (normKey.includes('location') || normKey.includes('ස්ථානය') || normKey.includes('ප්‍රදේශය')) {
            mapped.location = val;
          } else if (normKey.includes('organization') || normKey.includes('temple') || normKey.includes('විහාරය') || normKey.includes('owner') || normKey.includes('హిమිකරු')) {
            mapped.organization = val;
          } else if (normKey.includes('mahout') || normKey.includes('keeper') || normKey.includes('ඇත්ගොව්වා')) {
            mapped.mahout = val;
          } else if (normKey.includes('tusk') || normKey.includes('දළ')) {
            mapped.tusks = val;
          } else if (normKey.includes('physical') || normKey.includes('mark') || normKey.includes('ලක්ෂණ')) {
            mapped.physicalCharacteristics = val;
          } else if (normKey.includes('description') || normKey.includes('bio') || normKey.includes('විස්තරය') || normKey.includes('පසුබිම')) {
            mapped.description = val;
          } else if (normKey.includes('perahera') || normKey.includes('participation') || normKey.includes('පෙරහැර')) {
            mapped.peraheraParticipation = val;
          } else if (normKey.includes('photo') || normKey.includes('url') || normKey.includes('ඡායාරූප')) {
            mapped.photos = val;
          } else if (normKey.includes('status') || normKey.includes('තත්ත්වය')) {
            mapped.status = val;
          } else if (normKey.includes('verify') || normKey.includes('සත්‍යාපිත')) {
            mapped.verified = val;
          } else if (normKey.includes('feature') || normKey.includes('විශේෂ')) {
            mapped.isFeatured = val;
          } else if (normKey.includes('live')) {
            mapped.isLive = val;
          } else if (normKey.includes('badge') || normKey.includes('ලාංඡනය')) {
            mapped.customBadge = val;
          }
        });

        let name = mapped.name || '';
        let sinhalaName = mapped.sinhalaName || '';

        if (!name && sinhalaName) name = sinhalaName;
        if (!name) name = `Elephant_${idx + 1}`;

        let type: ElephantType = 'tusker';
        const typeStr = (mapped.type || '').toLowerCase();
        if (typeStr.includes('ali') || typeStr.includes('elep') || typeStr.includes('අලියා')) {
          type = 'elephant';
        }

        let gender: Gender = 'male';
        const genderStr = (mapped.gender || '').toLowerCase();
        if (genderStr.includes('fem') || genderStr.includes('gah') || genderStr.includes('ගැහැණු') || genderStr.includes('ඇතින්න')) {
          gender = 'female';
        }

        const otherNames = (mapped.otherNames || '')
          .split(/[,;\n|]/)
          .map((s: string) => s.trim())
          .filter(Boolean);

        const peraheras = (mapped.peraheraParticipation || '')
          .split(/[,;\n|]/)
          .map((s: string) => s.trim())
          .filter(Boolean);

        const parsedPhotos = (mapped.photos || '')
          .split(/[,;\n|]/)
          .map((s: string) => s.trim())
          .filter((s: string) => s.startsWith('http') || s.startsWith('data:image'));

        if (parsedPhotos.length === 0) {
          parsedPhotos.push(DEFAULT_SAMPLE_PHOTOS[idx % DEFAULT_SAMPLE_PHOTOS.length]);
        }

        const matchedElephant = findMatchingElephant(name, sinhalaName, otherNames);
        const isExistingMatch = Boolean(matchedElephant);
        const missingFieldsToFill = matchedElephant
          ? computeMissingFieldsToFill(matchedElephant, {
              sinhalaName,
              otherNames,
              age: mapped.age,
              dateOfBirth: mapped.dateOfBirth,
              location: mapped.location,
              organization: mapped.organization,
              mahout: mapped.mahout,
              tusks: mapped.tusks,
              physicalCharacteristics: mapped.physicalCharacteristics,
              description: mapped.description,
              peraheraParticipation: peraheras,
              photos: parsedPhotos,
            })
          : [];

        const isValid = name.trim().length > 0;

        return {
          name,
          sinhalaName,
          otherNames,
          gender,
          type,
          age: mapped.age || (mapped.dateOfBirth ? `${new Date().getFullYear() - parseInt(mapped.dateOfBirth) || ''}` : ''),
          dateOfBirth: String(mapped.dateOfBirth || ''),
          location: mapped.location || (matchedElephant?.location || 'Sri Lanka'),
          organization: mapped.organization || (matchedElephant?.organization || 'Sri Lanka'),
          mahout: mapped.mahout || (matchedElephant?.mahout || 'National Custodians'),
          tusks: mapped.tusks || (matchedElephant?.tusks || (type === 'tusker' ? 'දිගු සවිමත් යුගල දළ (Twin Tusks)' : 'N/A')),
          physicalCharacteristics: mapped.physicalCharacteristics || (matchedElephant?.physicalCharacteristics || ''),
          description: mapped.description || (matchedElephant?.description || (sinhalaName ? `${sinhalaName} - ශ්‍රී ලාංකේය හීලෑ ඇත් රජෙකි.` : `${name} - Sri Lankan domesticated elephant.`)),
          peraheraParticipation: peraheras,
          photos: parsedPhotos,
          status: mapped.status === 'memorial' ? 'memorial' : 'living',
          verified: mapped.verified === 'false' || mapped.verified === '0' ? false : true,
          isFeatured: mapped.isFeatured === 'true' || mapped.isFeatured === '1' || mapped.isFeatured === 'yes',
          isLive: mapped.isLive === 'true' || mapped.isLive === '1' || mapped.isLive === 'yes',
          customBadge: mapped.customBadge || '',
          isValid,
          validationError: !isValid ? 'Elephant name missing' : undefined,
          isExistingMatch,
          matchedElephant,
          matchedId: matchedElephant?.id,
          missingFieldsToFill,
        };
      });

      setParsedRows(rows);
      setStep('2_preview');
    } catch (err: any) {
      console.error('File parsing error:', err);
      alert(`Error reading file: ${err.message || err}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleReadUploadedFile = (selectedFile: File) => {
    setFile(selectedFile);
    setIsParsing(true);
    setImportComplete(false);
    setImportLogs([]);
    setLastFirestoreError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        if (!buffer) {
          throw new Error('Could not read file data as ArrayBuffer');
        }
        const data = new Uint8Array(buffer);
        const wb = XLSX.read(data, {
          type: 'array',
          cellDates: true,
          raw: false,
        });
        processWorkbook(wb);
      } catch (err: any) {
        console.warn('ArrayBuffer read failed, trying legacy binary fallback...', err);
        try {
          const binaryReader = new FileReader();
          binaryReader.onload = (binEvt) => {
            try {
              const binData = binEvt.target?.result;
              const wb = XLSX.read(binData, {
                type: 'binary',
                cellDates: true,
                raw: false,
              });
              processWorkbook(wb);
            } catch (binErr: any) {
              console.error('All file reading strategies failed.', binErr);
              alert(
                language === 'si'
                  ? `ගොනුව කියවීමට නොහැකි විය. කරුණාකර නිවැරදි Excel (.xlsx) ගොනුවක් භාවිතා කරන්න. (Error: ${binErr.message || binErr})`
                  : `Could not parse file. Please use a valid Excel (.xlsx) file. (Error: ${binErr.message || binErr})`
              );
              setIsParsing(false);
            }
          };
          binaryReader.readAsBinaryString(selectedFile);
        } catch (setupErr) {
          setIsParsing(false);
        }
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    handleReadUploadedFile(selected);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleReadUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveRow = (index: number) => {
    setParsedRows((prev) => prev.filter((_, i) => i !== index));
  };

  // -------------------------------------------------------------
  // SMART MERGE PAYLOAD BUILDER
  // -------------------------------------------------------------
  const buildSmartMergedPayload = (
    row: ParsedElephantRow,
    existing?: Elephant
  ): Omit<Elephant, 'id' | 'createdAt' | 'updatedAt'> => {
    if (!existing || importMode === 'overwrite_all') {
      return {
        name: row.name,
        sinhalaName: row.sinhalaName,
        otherNames: row.otherNames,
        gender: row.gender,
        type: row.type,
        age: row.age,
        dateOfBirth: row.dateOfBirth,
        location: row.location,
        organization: row.organization,
        mahout: row.mahout,
        tusks: row.tusks,
        physicalCharacteristics: row.physicalCharacteristics,
        description: row.description,
        peraheraParticipation: row.peraheraParticipation,
        photos: row.photos,
        status: row.status,
        verified: autoVerifyAll ? true : row.verified,
        isFeatured: row.isFeatured,
        isLive: row.isLive,
        customBadge: row.customBadge,
        sources: existing?.sources || [],
      };
    }

    if (importMode === 'add_only') {
      throw new Error(`Conflict skipped: '${row.name}' already exists.`);
    }

    // SMART MERGE MODE (Preserve existing field if occupied, else backfill from Excel)
    const mergedPhotos = [...(existing.photos || [])];
    if (row.photos && row.photos.length > 0) {
      row.photos.forEach((ph) => {
        if (!mergedPhotos.includes(ph) && !ph.includes('photo-1557050543')) {
          mergedPhotos.push(ph);
        }
      });
    }

    const mergedPeraheras = [...(existing.peraheraParticipation || [])];
    if (row.peraheraParticipation && row.peraheraParticipation.length > 0) {
      row.peraheraParticipation.forEach((p) => {
        if (!mergedPeraheras.some((ep) => normalizeText(ep) === normalizeText(p))) {
          mergedPeraheras.push(p);
        }
      });
    }

    const mergedOthers = [...(existing.otherNames || [])];
    if (row.otherNames && row.otherNames.length > 0) {
      row.otherNames.forEach((o) => {
        if (!mergedOthers.some((eo) => normalizeText(eo) === normalizeText(o))) {
          mergedOthers.push(o);
        }
      });
    }

    return {
      name: existing.name || row.name,
      sinhalaName: isMissingOrPlaceholder(existing.sinhalaName) ? row.sinhalaName : existing.sinhalaName,
      otherNames: mergedOthers,
      gender: existing.gender || row.gender,
      type: existing.type || row.type,
      age: isMissingOrPlaceholder(existing.age) ? row.age : existing.age,
      dateOfBirth: isMissingOrPlaceholder(existing.dateOfBirth) ? row.dateOfBirth : existing.dateOfBirth,
      location: isMissingOrPlaceholder(existing.location) ? row.location : existing.location,
      organization: isMissingOrPlaceholder(existing.organization) ? row.organization : existing.organization,
      mahout: isMissingOrPlaceholder(existing.mahout) ? row.mahout : existing.mahout,
      tusks: isMissingOrPlaceholder(existing.tusks) ? row.tusks : existing.tusks,
      physicalCharacteristics: isMissingOrPlaceholder(existing.physicalCharacteristics) ? row.physicalCharacteristics : existing.physicalCharacteristics,
      description: isMissingOrPlaceholder(existing.description) ? row.description : existing.description,
      peraheraParticipation: mergedPeraheras,
      photos: mergedPhotos,
      status: existing.status || row.status,
      verified: autoVerifyAll ? true : (existing.verified || row.verified),
      isFeatured: existing.isFeatured || row.isFeatured,
      isLive: existing.isLive || row.isLive,
      customBadge: existing.customBadge || row.customBadge,
      sources: existing.sources || [],
    };
  };

  const generateDeterministicId = (name: string): string => {
    if (!name) return `ele_${Math.random().toString(36).substring(2, 10)}`;
    const normalized = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '');
    return `ele_${normalized || Math.random().toString(36).substring(2, 10)}`;
  };

  // -------------------------------------------------------------
  // RUN DIAGNOSTIC CONNECTION TEST
  // -------------------------------------------------------------
  const handleTestDatabaseWrite = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const testRef = doc(db, 'elephants', 'test_write_diagnostic');
      await setDoc(testRef, {
        name: 'TEST_WRITE_DIAGNOSTIC_OK',
        test_timestamp: new Date().toISOString(),
        note: 'This is a temporary diagnostic write to verify client-to-Firestore write connection is active.'
      });
      setTestResult({ success: true });
    } catch (err: any) {
      console.error('Diagnostic write failed:', err);
      setTestResult({
        success: false,
        code: err.code || 'unknown',
        error: err.message || String(err)
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // -------------------------------------------------------------
  // EXECUTE BULK IMPORT
  // -------------------------------------------------------------
  const handleStartImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      alert('No valid profiles to import!');
      return;
    }

    if (isImporting) return;

    setStep('3_importing');
    setIsImporting(true);
    setImportComplete(false);
    cancelRef.current = false;
    setLastFirestoreError(null);

    const total = validRows.length;
    let successCount = 0;
    let failCount = 0;

    setImportLogs([]);
    setImportProgress({ current: 0, total, success: 0, failed: 0 });

    addLog(
      language === 'si' ? '🐘 දත්ත ඇතුළත් කිරීමේ ක්‍රියාවලිය ආරම්භ කරමින් පවතී...' : '🐘 Starting bulk import process...',
      'info'
    );

    const CHUNK_SIZE = 5;

    for (let chunkStart = 0; chunkStart < total; chunkStart += CHUNK_SIZE) {
      if (cancelRef.current) {
        addLog(
          language === 'si' ? '🛑 ඇතුළත් කිරීම පරිශීලකයා විසින් අවලංගු කරන ලදී.' : '🛑 Import process aborted by user.',
          'warn'
        );
        break;
      }

      const chunk = validRows.slice(chunkStart, chunkStart + CHUNK_SIZE);
      addLog(
        language === 'si'
          ? `⚙️ පේළි ${chunkStart + 1} - ${Math.min(chunkStart + CHUNK_SIZE, total)} සකසමින් (ඡායාරූප සම්පීඩනය කරමින්)...`
          : `⚙️ Processing rows ${chunkStart + 1} - ${Math.min(chunkStart + CHUNK_SIZE, total)} of ${total} (compressing Base64 images)...`,
        'info'
      );

      const chunkOperations: { id: string; payload: any; isExisting: boolean; originalName: string }[] = [];

      for (const row of chunk) {
        try {
          const isMatch = row.isExistingMatch && row.matchedElephant;
          const targetId = (importMode !== 'add_only' && isMatch)
            ? row.matchedId!
            : (row.id || generateDeterministicId(row.name));

          const payload = buildSmartMergedPayload(row, (importMode !== 'add_only' && isMatch) ? row.matchedElephant : undefined);

          // Base64 Image Compression to fit under Firestore document limits
          if (payload.photos && payload.photos.length > 0) {
            payload.photos = await Promise.all(
              payload.photos.map(async (photo) => {
                if (photo.startsWith('data:image')) {
                  try {
                    return await compressBase64Image(photo, { maxDimension: 600, quality: 0.6 });
                  } catch (e) {
                    return photo;
                  }
                }
                return photo;
              })
            );
          }

          chunkOperations.push({
            id: targetId,
            payload,
            isExisting: !!(importMode !== 'add_only' && isMatch),
            originalName: row.name,
          });
        } catch (prepErr: any) {
          failCount++;
          addLog(`✗ Preprocessing failed for ${row.name}: ${prepErr.message || prepErr}`, 'error');
          setImportProgress((prev) =>
            prev ? { ...prev, current: prev.current + 1, failed: prev.failed + 1 } : null
          );
        }
      }

      if (chunkOperations.length === 0) continue;

      let chunkSuccess = false;
      const MAX_RETRIES = 3;

      for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
        if (cancelRef.current) break;

        try {
          const batch = writeBatch(db);

          chunkOperations.forEach((op) => {
            const docRef = doc(db, 'elephants', op.id);
            const dataToSet = {
              ...op.payload,
              updatedAt: serverTimestamp(),
            };
            if (!op.isExisting) {
              dataToSet.createdAt = serverTimestamp();
            }
            batch.set(docRef, dataToSet, { merge: true });
          });

          const commitPromise = batch.commit();
          const timeoutMs = 25000; // 25s limit

          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
          });

          await Promise.race([commitPromise, timeoutPromise]);

          chunkSuccess = true;
          successCount += chunkOperations.length;

          chunkOperations.forEach((op) => {
            if (op.isExisting) {
              addLog(`✓ ${op.originalName} - Merged profile successfully`, 'success');
            } else {
              addLog(`✓ ${op.originalName} - Created new profile successfully`, 'success');
            }
          });

          setImportProgress((prev) =>
            prev
              ? {
                  ...prev,
                  current: Math.min(prev.current + chunkOperations.length, total),
                  success: prev.success + chunkOperations.length,
                }
              : null
          );
          break; // Exit retry loop
        } catch (err: any) {
          const isTimeout = err.message === 'TIMEOUT';
          const errorCode = err.code || 'unknown';
          const errorMessage = err.message || String(err);

          // Save last error for diagnostics
          setLastFirestoreError({
            code: errorCode,
            message: errorMessage,
            phase: `Writing batch chunk starting with ${chunkOperations[0]?.originalName}`
          });

          const isRetryable =
            isTimeout ||
            errorCode === 'unavailable' ||
            errorCode === 'deadline-exceeded' ||
            errorCode === 'resource-exhausted' ||
            errorCode === 'internal' ||
            errorCode === 'aborted' ||
            errorMessage.toLowerCase().includes('offline') ||
            errorMessage.toLowerCase().includes('network') ||
            errorMessage.toLowerCase().includes('timeout');

          if (isRetryable && attempt <= MAX_RETRIES) {
            const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
            addLog(
              language === 'si'
                ? `⚠️ තාවකාලික දෝෂයකි: ${errorCode} (${attempt}/${MAX_RETRIES}). තත්පර ${Math.round(backoffMs / 1000)} කින් නැවත උත්සාහ කරයි...`
                : `⚠️ Temporary DB write issue: ${errorCode} (Attempt ${attempt}/${MAX_RETRIES}). Retrying in ${Math.round(backoffMs / 1000)}s...`,
              'warn'
            );
            await new Promise((r) => setTimeout(r, backoffMs));
          } else {
            // Permanent failure
            failCount += chunkOperations.length;
            const errorLabel = isTimeout ? 'Timeout' : `Error: ${errorCode}`;
            addLog(`✗ Batch upload failed permanently [${errorLabel}]: ${errorMessage}`, 'error');
            chunkOperations.forEach((op) => {
              addLog(`  - Failed: ${op.originalName}`, 'error');
            });
            
            setImportProgress((prev) =>
              prev
                ? {
                    ...prev,
                    current: Math.min(prev.current + chunkOperations.length, total),
                    failed: prev.failed + chunkOperations.length,
                  }
                : null
            );
            break; // Exit retry loop
          }
        }
      }
    }

    // Refresh memory registry view on completion
    if (successCount > 0) {
      try {
        addLog(
          language === 'si' ? '🔄 දත්ත ගබඩාවේ නව දත්ත යාවත්කාලීන කරමින් පවතී...' : '🔄 Synchronizing local elephant registry...',
          'info'
        );
        await onSaveElephant({ name: '__REFRESH__' } as any);
        addLog(
          language === 'si' ? '✓ පද්ධති ලේඛන සාර්ථකව යාවත්කාලීන කරන ලදී!' : '✓ Elephant registry synchronized successfully!',
          'success'
        );
      } catch (e) {
        console.warn('Final state refresh notice:', e);
      }
    }

    setImportProgress({ current: total, total, success: successCount, failed: failCount });
    setIsImporting(false);
    setImportComplete(true);
  };

  const filteredPreviewRows = parsedRows.filter((r) => {
    if (!previewSearch) return true;
    const s = previewSearch.toLowerCase();
    return (
      r.name.toLowerCase().includes(s) ||
      r.sinhalaName.includes(s) ||
      r.location.toLowerCase().includes(s) ||
      r.organization.toLowerCase().includes(s)
    );
  });

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const matchCount = parsedRows.filter((r) => r.isExistingMatch).length;

  return (
    <div className="space-y-6 animate-fadeIn text-[#062E22]">
      
      {/* ------------------------------------------------------------- */}
      {/* HEADER SECTION                                                */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-gradient-to-br from-[#062E22] via-[#0b4a37] to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-emerald-500/20">
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-amber-400 text-zinc-950 shadow-md uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Smart Import Wizard</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
            {language === 'si'
              ? 'Excel දත්ත එකවර පද්ධතියට ඇතුළත් කරන්න'
              : 'Bulk Import Elephant Registry'}
          </h2>

          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed font-medium">
            {language === 'si'
              ? 'විහාරස්ථාන හෝ ලේඛනාගාර සතු අලි ඇතුන්ගේ තොරතුරු Excel (.xlsx) හෝ CSV (.csv) ගොනුවක් හරහා එකවර පද්ධතියට ඇතුළත් කරන්න. දැනට සිටින අලි ඇතුන්ගේ පැතිකඩ ස්වයංක්‍රීයව හඳුනාගෙන, අඩුව තිබූ තොරතුරු (Missing Fields) පමණක් පිරවීමේ හැකියාවද ඇත.'
              : 'Add or update multiple domesticated elephants at once using an Excel or CSV spreadsheet. Profiles matching existing registry entries will be smartly merged to fill missing photos, aliases, or details without wiping current records.'}
          </p>

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              onClick={handleDownloadExcelTemplate}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Download Excel Template (.xlsx)</span>
            </button>

            <button
              onClick={handleDownloadCSVTemplate}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-xl text-xs font-bold flex items-center gap-2 backdrop-blur-xs transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download CSV Template (.csv)</span>
            </button>
          </div>
        </div>

        <FileSpreadsheet className="absolute -right-8 -bottom-8 w-56 h-56 text-white/5 pointer-events-none" />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* WIZARD STEP 1: UPLOAD AND DIAGNOSTIC                           */}
      {/* ------------------------------------------------------------- */}
      {step === '1_upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Upload Dropzone */}
          <div className="lg:col-span-2 space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="bg-white rounded-3xl p-10 sm:p-14 border-3 border-dashed border-emerald-200 hover:border-emerald-600 transition-all cursor-pointer text-center space-y-4 shadow-sm group hover:shadow-md relative overflow-hidden"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-20 h-20 rounded-2xl bg-emerald-50 group-hover:bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto transition-transform group-hover:scale-110 shadow-sm border border-emerald-100">
                <Upload className="w-10 h-10 animate-bounce" style={{ animationDuration: '3s' }} />
              </div>

              <div className="space-y-1.5">
                <h3 className="font-extrabold text-base sm:text-lg text-[#062E22]">
                  {language === 'si' ? 'Excel (.xlsx) හෝ CSV (.csv) ගොනුව මෙතැනට Drag & Drop කරන්න' : 'Drag & Drop your spreadsheet here'}
                </h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto leading-normal font-medium">
                  {language === 'si'
                    ? 'එසේ නැතහොත් ඔබේ පරිගණකයෙන් හෝ දුරකථනයෙන් ගොනුවක් තෝරා ගැනීමට මෙතැන ක්ලික් කරන්න. සපයා ඇති Excel Template එකට අනුව දත්ත සකස් කර තිබීම වඩාත් යෝග්‍ය වේ.'
                    : 'or click to browse local files. For flawless data mapping, ensure columns match the provided template.'}
                </p>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FAF9F5] border border-zinc-200 rounded-full text-[10px] text-zinc-600 font-bold">
                <Info className="w-3.5 h-3.5 text-emerald-700" />
                <span>Supports .xlsx, .xls, and .csv formats</span>
              </div>

              {isParsing && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-8 h-8 text-emerald-700 animate-spin" />
                  <p className="text-xs font-black text-emerald-950 animate-pulse">
                    Parsing Excel columns & analyzing existing registry matches...
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Diagnostic Sidebar (Crucial for Firestore status diagnosis) */}
          <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                <Wrench className="w-5 h-5 text-amber-600" />
                <h3 className="font-black text-sm uppercase tracking-wider text-zinc-800">
                  DB Write Diagnostic
                </h3>
              </div>

              <p className="text-xs text-zinc-600 leading-normal font-medium">
                Before uploading, you can verify if your client-to-Firestore write stream is active. This tests if your current project is fully setup.
              </p>

              {testResult && (
                <div className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-1 ${
                  testResult.success 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950' 
                    : 'bg-red-50 border-red-200 text-red-950'
                }`}>
                  <div className="font-bold flex items-center gap-1.5">
                    {testResult.success ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                        <span>Diagnostic Write Successful!</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <span>Write Failed: {testResult.code}</span>
                      </>
                    )}
                  </div>
                  {!testResult.success && (
                    <p className="text-[10px] text-red-900/80 font-mono break-words mt-1">
                      {testResult.error}
                    </p>
                  )}
                  {testResult.success && (
                    <p className="text-[11px] text-emerald-900/90 font-medium">
                      Your Firestore allows public writes. You can safely trigger the bulk import process.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={handleTestDatabaseWrite}
                disabled={testingConnection}
                className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {testingConnection ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-zinc-600" />
                ) : (
                  <Play className="w-4 h-4 text-emerald-700" />
                )}
                <span>Test Firestore Connection</span>
              </button>

              {!testResult?.success && testResult !== null && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-[10px] text-amber-950 space-y-1 font-medium leading-normal">
                  <span className="font-extrabold flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
                    How to fix Firestore writes:
                  </span>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Open your Firebase Console.</li>
                    <li>Ensure <strong>Firestore Database</strong> has been created.</li>
                    <li>Ensure database is in <strong>Native Mode</strong> (not Datastore mode).</li>
                    <li>Verify Rules allow writing to the <code>elephants</code> collection.</li>
                  </ol>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* WIZARD STEP 2: PREVIEW & CONFLICT RESOLUTION                  */}
      {/* ------------------------------------------------------------- */}
      {step === '2_preview' && parsedRows.length > 0 && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Wizard Control Panel */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-zinc-200 shadow-sm space-y-5">
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
              <div>
                <h3 className="font-extrabold text-lg text-[#062E22] flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-700" />
                  <span>
                    {language === 'si'
                      ? `හඳුනාගත් අලි වාර්තා පෙරදසුන (${parsedRows.length})`
                      : `Import File Preview (${parsedRows.length} Elephants Found)`}
                  </span>
                </h3>
                <p className="text-xs text-zinc-500 mt-1 flex items-center gap-2 font-medium">
                  <span className="font-bold text-emerald-700">{validCount} Valid Records</span>
                  <span>•</span>
                  <span className="font-bold text-amber-700">{matchCount} Match Found in Registry</span>
                </p>
              </div>

              {/* Import Mode Settings (Interactive conflict resolution) */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                
                {/* Conflict Mode */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-400 font-extrabold uppercase">Conflict Strategy:</span>
                  <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200">
                    <button
                      type="button"
                      onClick={() => setImportMode('smart_merge')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        importMode === 'smart_merge'
                          ? 'bg-emerald-700 text-white shadow-sm'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                      title="Keep existing data, only fill in blank or empty columns"
                    >
                      <DatabaseZap className="w-3.5 h-3.5" />
                      <span>Smart Merge</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setImportMode('overwrite_all')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        importMode === 'overwrite_all'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                      title="Overwrite profiles with Excel values completely"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Overwrite All</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setImportMode('add_only')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        importMode === 'add_only'
                          ? 'bg-zinc-800 text-white shadow-sm'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                      title="Only add new names, ignore rows matching existing names"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Add Only</span>
                    </button>
                  </div>
                </div>

                {/* Auto Verify */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-400 font-extrabold uppercase">Verify Profiles:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer bg-zinc-50 hover:bg-zinc-100 px-3.5 py-2 rounded-xl border border-zinc-200 font-bold transition-colors">
                    <input
                      type="checkbox"
                      checked={autoVerifyAll}
                      onChange={(e) => setAutoVerifyAll(e.target.checked)}
                      className="rounded text-emerald-700 focus:ring-emerald-700"
                    />
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Set as Verified</span>
                    </span>
                  </label>
                </div>

              </div>
            </div>

            {/* Smart Merge Summary Cards */}
            {matchCount > 0 && importMode === 'smart_merge' && (
              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-950 flex items-start gap-3 shadow-2xs">
                <Sparkles className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-extrabold">Smart Merge Mode is Active:</span>
                  <p className="text-amber-900/90 leading-relaxed font-medium">
                    The importer detected <strong>{matchCount} matched names</strong> in your local database. It will scan each profile and only patch empty fields (e.g. bio, location, mahout details, extra photos) without overwriting what you already stored. This prevents destructive data loss.
                  </p>
                </div>
              </div>
            )}

            {/* Search and Preview Filters */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Filter rows in sheet..."
                  value={previewSearch}
                  onChange={(e) => setPreviewSearch(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto max-h-[380px] rounded-2xl border border-zinc-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF9F5] border-b border-zinc-200 text-zinc-500 font-extrabold uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Elephant Profile</th>
                    <th className="py-3 px-4">Type & Gender</th>
                    <th className="py-3 px-4">Location / Owner</th>
                    <th className="py-3 px-4 text-center">Conflict Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredPreviewRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="py-3 px-4 font-mono text-zinc-400 font-bold">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={row.photos[0]}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover border border-zinc-200 flex-shrink-0"
                          />
                          <div className="min-w-0 max-w-[180px]">
                            <div className="font-extrabold text-[#062E22] truncate flex items-center gap-1">
                              <span>{row.name}</span>
                              {row.verified && (
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600/10" />
                              )}
                            </div>
                            {row.sinhalaName && (
                              <p className="text-[10px] text-emerald-800 truncate font-sinhala">
                                {row.sinhalaName}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                            row.type === 'tusker' ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-emerald-100 text-emerald-900'
                          }`}>
                            {row.type}
                          </span>
                          <span className="block text-[10px] font-bold text-zinc-400 uppercase">
                            {row.gender} • {row.age ? `${row.age} yrs` : 'Age N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="truncate max-w-[180px] font-extrabold text-zinc-700">
                          {row.organization}
                        </div>
                        <div className="text-[10px] text-zinc-400 truncate">
                          {row.location}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.isExistingMatch ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full font-extrabold text-[9px] border border-amber-200">
                              CONFLICT: MATCH
                            </span>
                            {importMode === 'smart_merge' && row.missingFieldsToFill && row.missingFieldsToFill.length > 0 && (
                              <span className="text-[9px] text-amber-800 mt-0.5 font-bold">
                                Will populate: {row.missingFieldsToFill.slice(0, 2).join(', ')}...
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-full font-extrabold text-[9px] border border-emerald-200">
                            NEW REGISTER
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleRemoveRow(idx)}
                          className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Exclude record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Form Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => {
                  setParsedRows([]);
                  setFile(null);
                  setStep('1_upload');
                }}
                className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Reset & Upload New File
              </button>

              <button
                onClick={handleStartImport}
                className="px-6 py-3 bg-[#062E22] hover:bg-emerald-900 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <CheckCheck className="w-4 h-4 text-emerald-400" />
                <span>Confirm & Start Import ({validCount} Elephants)</span>
              </button>
            </div>

          </div>

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* WIZARD STEP 3: EXECUTION MONITOR & LOGS                       */}
      {/* ------------------------------------------------------------- */}
      {step === '3_importing' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          
          {/* Progress & Stats Card */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm space-y-6">
              
              <div className="space-y-1.5 border-b border-zinc-100 pb-4">
                <h3 className="font-black text-sm uppercase tracking-wider text-zinc-800 flex items-center gap-2">
                  <Settings className="w-4 h-4 animate-spin text-emerald-700" />
                  <span>Import Statistics</span>
                </h3>
                <p className="text-xs text-zinc-400 font-semibold uppercase">
                  Current session results
                </p>
              </div>

              {importProgress && (
                <div className="space-y-4">
                  
                  {/* Circular/Semi-circular progress estimation */}
                  <div className="text-center space-y-1">
                    <div className="text-4xl font-black text-[#062E22]">
                      {Math.round((importProgress.current / importProgress.total) * 100)}%
                    </div>
                    <div className="text-[10px] text-zinc-400 font-extrabold uppercase">
                      Progress ({importProgress.current} / {importProgress.total} profiles)
                    </div>
                  </div>

                  {/* Horizontal progress bar */}
                  <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden border border-zinc-200">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-emerald-50/50 border border-emerald-150 p-3 rounded-2xl text-center space-y-0.5">
                      <span className="block text-[10px] text-emerald-800 font-extrabold uppercase">Success</span>
                      <span className="text-xl font-black text-emerald-950">{importProgress.success}</span>
                    </div>

                    <div className="bg-red-50/50 border border-red-150 p-3 rounded-2xl text-center space-y-0.5">
                      <span className="block text-[10px] text-red-800 font-extrabold uppercase">Failed</span>
                      <span className="text-xl font-black text-red-950">{importProgress.failed}</span>
                    </div>
                  </div>

                </div>
              )}

              {/* Real-time Diagnostics Guide if last write failed */}
              {lastFirestoreError && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-2 text-xs text-red-950 animate-fadeIn">
                  <div className="font-extrabold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-700 flex-shrink-0" />
                    <span>Real-Time DB Alert: {lastFirestoreError.code}</span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-red-900/90 font-mono break-words">
                    {lastFirestoreError.message}
                  </p>
                  <div className="pt-2 border-t border-red-200 mt-1 space-y-1 text-[10px] text-red-900/80 leading-normal font-medium">
                    <span className="font-bold block text-red-950">Diagnostic Advice:</span>
                    <p>
                      Firestore writes are hanging or timing out. This typically means the Firebase project's Firestore database has not been initialized in Native Mode or its Security Rules block writes. Check your rules and console.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 border-t border-zinc-100 pt-5">
                {isImporting ? (
                  <button
                    onClick={handleCancelImport}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancel Pending Chunks</span>
                  </button>
                ) : (
                  <button
                    onClick={onFinished}
                    className="w-full py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    Close Import Wizard
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* Interactive Live Log Terminal */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-zinc-900 text-[#a3efa0] rounded-3xl overflow-hidden border border-zinc-800 shadow-xl flex flex-col h-[480px]">
              
              {/* Terminal Title Bar */}
              <div className="bg-zinc-950 px-5 py-3 border-b border-zinc-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#a3efa0]" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-300">
                    Importer Terminal Engine
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#a3efa0] animate-pulse" />
                </div>
              </div>

              {/* Terminal Logs Container */}
              <div className="flex-1 p-5 overflow-y-auto space-y-2 font-mono text-xs leading-relaxed text-zinc-200">
                {importLogs.length === 0 && (
                  <div className="text-zinc-500 italic text-center py-12 animate-pulse font-medium">
                    Initialising logs... Waiting to write batch chunks...
                  </div>
                )}
                {importLogs.map((log, idx) => {
                  let color = 'text-zinc-300';
                  if (log.type === 'success') color = 'text-emerald-400 font-bold';
                  if (log.type === 'warn') color = 'text-amber-400 font-bold';
                  if (log.type === 'error') color = 'text-rose-400 font-extrabold';

                  return (
                    <div key={idx} className="flex items-start gap-2.5 animate-fadeIn">
                      <span className="text-zinc-600 font-bold flex-shrink-0 select-none">
                        [{log.time}]
                      </span>
                      <span className={`${color} whitespace-pre-wrap flex-1`}>
                        {log.text}
                      </span>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>

        </div>
      )}

    </div>
  );
}
