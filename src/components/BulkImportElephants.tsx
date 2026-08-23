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
  HelpCircle
} from 'lucide-react';
import { Language } from '../utils/translations';

interface BulkImportElephantsProps {
  existingElephants: Elephant[];
  onSaveElephant: (elephant: Omit<Elephant, 'id' | 'createdAt' | 'updatedAt'>, id?: string, skipRefresh?: boolean) => Promise<void>;
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

/**
 * Normalizes string for fuzzy key/name comparison
 */
function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\-_.,/()'"[\]:;]+/g, '');
}

/**
 * Checks if a value is empty, placeholder or default
 */
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

export const BulkImportElephants: React.FC<BulkImportElephantsProps> = ({
  existingElephants,
  onSaveElephant,
  language,
  onFinished,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedElephantRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; success: number; failed: number } | null>(null);
  const [importMode, setImportMode] = useState<'smart_merge' | 'overwrite_all' | 'add_only'>('smart_merge');
  const [autoVerifyAll, setAutoVerifyAll] = useState(true);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [importComplete, setImportComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------
  // 1. TEMPLATES (Excel .xlsx & CSV .csv)
  // -------------------------------------------------------------
  const sampleTemplateData = [
    {
      'Elephant Name': 'Indiraja',
      'Sinhala Name': 'ඉන්දිරාජා',
      'Other Names': 'Indi Raja, Maligawa Indiraja',
      'Type (tusker/elephant)': 'tusker',
      'Gender (male/female)': 'male',
      'Age': 44,
      'Date of Birth': '1980',
      'Location': 'Kandy (මහනුවර)',
      'Organization / Temple': 'Sri Dalada Maligawa (ශ්‍රී දළදා මාළිගාව)',
      'Mahout': 'Kankanama Nilame / Chief Maligawa Mahout',
      'Tusks Details': 'දිගු සවිමත් යුගල දළ (Twin prominent tusks)',
      'Physical Characteristics': 'උස අඩි 9.5, පිරිපුන් ශරීර ලක්ෂණ, රාජකීය පෙනුම',
      'Description': 'ශ්‍රී දළදා මාළිගාවේ කරඬුව වඩමවන ප්‍රධාන රාජකීය හස්තිරාජයා.',
      'Perahera Participation': 'Kandy Esala Perahera, Bellanwila Perahera',
      'Photos (URLs comma separated)': 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80',
      'Status (living/memorial)': 'living',
      'Verified (TRUE/FALSE)': 'TRUE',
      'Featured (TRUE/FALSE)': 'TRUE',
      'LIVE (TRUE/FALSE)': 'FALSE',
      'Custom Badge': 'Chief Casket Bearer',
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
    },
    {
      'Elephant Name': 'Kandula',
      'Sinhala Name': 'කණ්ඩුල',
      'Other Names': 'Kelaniya Kandula',
      'Type (tusker/elephant)': 'tusker',
      'Gender (male/female)': 'male',
      'Age': 24,
      'Date of Birth': '2000',
      'Location': 'Kelaniya, Colombo',
      'Organization / Temple': 'Kelaniya Raja Maha Viharaya (කැලණිය රජ මහා විහාරය)',
      'Mahout': 'Kelaniya Caretakers',
      'Tusks Details': 'සුදු පැහැති දිගු දළ යුගල',
      'Physical Characteristics': 'ගාම්භීර ගමන් විලාශය සහ පැහැදිලි කන් රටා',
      'Description': 'කැලණිය දුරුතු මහා පෙරහැරේ ප්‍රධාන තැන් දරන ඇත් රජු.',
      'Perahera Participation': 'Kelaniya Duruthu Perahera',
      'Photos (URLs comma separated)': 'https://images.unsplash.com/photo-1549366021-9f761d450615?auto=format&fit=crop&w=1200&q=80',
      'Status (living/memorial)': 'living',
      'Verified (TRUE/FALSE)': 'TRUE',
      'Featured (TRUE/FALSE)': 'FALSE',
      'LIVE (TRUE/FALSE)': 'FALSE',
      'Custom Badge': 'Duruthu Perahera Tusker',
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
  // 2. INTELLIGENT MATCHING HELPER
  // -------------------------------------------------------------
  const findMatchingElephant = (name: string, sinhalaName: string, otherNames: string[] = []): Elephant | undefined => {
    const normName = normalizeText(name);
    const normSinhala = normalizeText(sinhalaName);
    const normOthers = otherNames.map(normalizeText).filter(Boolean);

    for (const el of existingElephants) {
      const elNameNorm = normalizeText(el.name);
      const elSinhalaNorm = normalizeText(el.sinhalaName || '');
      const elOtherNorms = (el.otherNames || []).map(normalizeText).filter(Boolean);

      // Direct match on English or Sinhala Name
      if (normName && (normName === elNameNorm || normName === elSinhalaNorm)) return el;
      if (normSinhala && (normSinhala === elSinhalaNorm || normSinhala === elNameNorm)) return el;

      // Match against Other Names / Aliases
      if (normName && elOtherNorms.includes(normName)) return el;
      if (normSinhala && elOtherNorms.includes(normSinhala)) return el;

      for (const o of normOthers) {
        if (o === elNameNorm || o === elSinhalaNorm || elOtherNorms.includes(o)) {
          return el;
        }
      }

      // Partial / Containment check for prominent names (e.g. "Nadungamuwa Raja" vs "Nadungamuwa Vijaya Raja")
      if (normName.length >= 6 && elNameNorm.length >= 6) {
        if (normName.includes(elNameNorm) || elNameNorm.includes(normName)) return el;
      }
      if (normSinhala.length >= 6 && elSinhalaNorm.length >= 6) {
        if (normSinhala.includes(elSinhalaNorm) || elSinhalaNorm.includes(normSinhala)) return el;
      }
    }
    return undefined;
  };

  /**
   * Determine which fields of existing elephant will be filled/updated from file row
   */
  const computeMissingFieldsToFill = (existing: Elephant, row: Partial<ParsedElephantRow>): string[] => {
    const fields: string[] = [];

    if (isMissingOrPlaceholder(existing.sinhalaName) && !isMissingOrPlaceholder(row.sinhalaName)) {
      fields.push('Sinhala Name (සිංහල නම)');
    }
    if (isMissingOrPlaceholder(existing.age) && !isMissingOrPlaceholder(row.age)) {
      fields.push('Age (වයස)');
    }
    if (isMissingOrPlaceholder(existing.dateOfBirth) && !isMissingOrPlaceholder(row.dateOfBirth)) {
      fields.push('Date of Birth (උපන් වර්ෂය)');
    }
    if (isMissingOrPlaceholder(existing.mahout) && !isMissingOrPlaceholder(row.mahout)) {
      fields.push('Mahout (ඇත්ගොව්වා)');
    }
    if (isMissingOrPlaceholder(existing.tusks) && !isMissingOrPlaceholder(row.tusks)) {
      fields.push('Tusks Details (දළ විස්තර)');
    }
    if (isMissingOrPlaceholder(existing.organization) && !isMissingOrPlaceholder(row.organization)) {
      fields.push('Organization/Temple (විහාරය/හිමිකරු)');
    }
    if (isMissingOrPlaceholder(existing.location) && !isMissingOrPlaceholder(row.location)) {
      fields.push('Location (ස්ථානය)');
    }
    if (isMissingOrPlaceholder(existing.physicalCharacteristics) && !isMissingOrPlaceholder(row.physicalCharacteristics)) {
      fields.push('Physical Characteristics (ලක්ෂණ)');
    }
    if (isMissingOrPlaceholder(existing.description) && !isMissingOrPlaceholder(row.description)) {
      fields.push('Description (විස්තරය)');
    }
    if (row.peraheraParticipation && row.peraheraParticipation.length > 0) {
      const newPeraheras = row.peraheraParticipation.filter(
        (p) => !(existing.peraheraParticipation || []).some((ep) => normalizeText(ep) === normalizeText(p))
      );
      if (newPeraheras.length > 0) {
        fields.push(`Peraheras (+${newPeraheras.length} පෙරහැර)`);
      }
    }
    if (row.otherNames && row.otherNames.length > 0) {
      const newOthers = row.otherNames.filter(
        (o) => !(existing.otherNames || []).some((eo) => normalizeText(eo) === normalizeText(o))
      );
      if (newOthers.length > 0) {
        fields.push(`Other Names (+${newOthers.length} නම්)`);
      }
    }
    if (row.photos && row.photos.length > 0) {
      const newPhotos = row.photos.filter((p) => !(existing.photos || []).includes(p));
      if (newPhotos.length > 0 && !newPhotos[0].includes('photo-1557050543')) {
        fields.push(`Photos (+${newPhotos.length} ඡායාරූප)`);
      }
    }

    return fields;
  };

  // -------------------------------------------------------------
  // 3. PARSE EXCEL / CSV ROBUST WORKBOOK
  // -------------------------------------------------------------
  const processWorkbook = (wb: XLSX.WorkBook) => {
    try {
      if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
        alert(language === 'si' ? 'Excel ගොනුවේ කිසිදු Sheet එකක් හමු නොවීය.' : 'No sheets found in workbook.');
        setIsParsing(false);
        return;
      }

      // Find first non-empty sheet
      let targetSheet: XLSX.WorkSheet | null = null;
      let targetSheetName = '';

      for (const name of wb.SheetNames) {
        const s = wb.Sheets[name];
        if (s && s['!ref']) {
          targetSheet = s;
          targetSheetName = name;
          break;
        }
      }

      if (!targetSheet) {
        targetSheet = wb.Sheets[wb.SheetNames[0]];
      }

      if (!targetSheet) {
        alert(language === 'si' ? 'Excel ගොනුවේ කිසිදු වලංගු Sheet එකක් හමු නොවීය.' : 'No valid sheet found in workbook.');
        setIsParsing(false);
        return;
      }

      const rawData: Record<string, any>[] = XLSX.utils.sheet_to_json(targetSheet, {
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

          // Sinhala Name
          if (
            normKey.includes('sinhala') ||
            normKey.includes('සිංහල') ||
            normKey === 'sinhalaname' ||
            normKey === 'sinh'
          ) {
            mapped.sinhalaName = val;
          }
          // Primary Name
          else if (
            normKey.includes('name') ||
            normKey.includes('title') ||
            normKey.includes('elephantname') ||
            normKey.includes('නම') ||
            normKey.includes('අලියාගේනම') ||
            normKey.includes('ඇතාගේනම')
          ) {
            if (!mapped.name) mapped.name = val;
          }
          // Other Names / Aliases
          else if (
            normKey.includes('other') ||
            normKey.includes('alias') ||
            normKey.includes('nickname') ||
            normKey.includes('වෙනත්') ||
            normKey.includes('අන්වර්ථ')
          ) {
            mapped.otherNames = val;
          }
          // Type (Tusker vs Elephant)
          else if (normKey.includes('type') || normKey.includes('category') || normKey.includes('වර්ගය') || normKey.includes('කුලය')) {
            mapped.type = val.toLowerCase();
          }
          // Gender
          else if (normKey.includes('gender') || normKey.includes('sex') || normKey.includes('ලිංගය') || normKey.includes('ස්ත්‍රී')) {
            mapped.gender = val.toLowerCase();
          }
          // Age
          else if (normKey === 'age' || normKey.includes('වයස') || normKey.includes('අවුරුදු')) {
            mapped.age = val;
          }
          // Date of birth
          else if (normKey.includes('birth') || normKey.includes('dob') || normKey.includes('උපන්')) {
            mapped.dateOfBirth = val;
          }
          // Location
          else if (normKey.includes('loc') || normKey.includes('city') || normKey.includes('place') || normKey.includes('ස්ථානය') || normKey.includes('නගරය') || normKey.includes('ප්‍රදේශය')) {
            mapped.location = val;
          }
          // Organization / Temple
          else if (
            normKey.includes('org') ||
            normKey.includes('temple') ||
            normKey.includes('owner') ||
            normKey.includes('custodian') ||
            normKey.includes('විහාරය') ||
            normKey.includes('ආයතනය') ||
            normKey.includes('හිමිකරු')
          ) {
            mapped.organization = val;
          }
          // Mahout
          else if (normKey.includes('mahout') || normKey.includes('keeper') || normKey.includes('caretaker') || normKey.includes('ඇත්ගොව්වා') || normKey.includes('ගොව්වා')) {
            mapped.mahout = val;
          }
          // Tusks
          else if (normKey.includes('tusk') || normKey.includes('ivory') || normKey.includes('දළ')) {
            mapped.tusks = val;
          }
          // Physical characteristics
          else if (
            normKey.includes('physic') ||
            normKey.includes('charac') ||
            normKey.includes('feature') ||
            normKey.includes('height') ||
            normKey.includes('ශාරීරික') ||
            normKey.includes('ලක්ෂණ')
          ) {
            mapped.physicalCharacteristics = val;
          }
          // Description
          else if (
            normKey.includes('desc') ||
            normKey.includes('detail') ||
            normKey.includes('bio') ||
            normKey.includes('about') ||
            normKey.includes('විස්තර')
          ) {
            mapped.description = val;
          }
          // Perahera Participation
          else if (normKey.includes('perah') || normKey.includes('fest') || normKey.includes('event') || normKey.includes('පෙරහැර')) {
            mapped.peraheraParticipation = val;
          }
          // Photos
          else if (normKey.includes('photo') || normKey.includes('image') || normKey.includes('url') || normKey.includes('ඡායාරූප') || normKey.includes('පින්තූර')) {
            mapped.photos = val;
          }
          // Status
          else if (normKey.includes('status') || normKey.includes('alive') || normKey.includes('තත්ත්වය')) {
            mapped.status = val.toLowerCase();
          }
          // Verified
          else if (normKey.includes('verif') || normKey.includes('සත්‍යාපිත')) {
            mapped.verified = val.toLowerCase();
          }
          // Featured
          else if (normKey.includes('feat') || normKey.includes('විශේෂිත')) {
            mapped.isFeatured = val.toLowerCase();
          }
          // LIVE
          else if (normKey.includes('live') || normKey.includes('සජීවී')) {
            mapped.isLive = val.toLowerCase();
          }
          // Custom Badge
          else if (normKey.includes('badge') || normKey.includes('honor') || normKey.includes('ලාංඡනය')) {
            mapped.customBadge = val;
          }
        });

        // Resolve Primary Names
        let name = mapped.name || (typeof rawRow['Name'] === 'string' ? rawRow['Name'].trim() : '') || (typeof rawRow['Elephant Name'] === 'string' ? rawRow['Elephant Name'].trim() : '');
        let sinhalaName = mapped.sinhalaName || (typeof rawRow['Sinhala Name'] === 'string' ? rawRow['Sinhala Name'].trim() : '');

        // If English name contains Sinhala characters and no english name
        if (!name && sinhalaName) {
          name = sinhalaName;
        }
        if (!name) {
          name = `Elephant_${idx + 1}`;
        }

        // Type
        let elephantType: ElephantType = 'tusker';
        const typeStr = (mapped.type || '').toLowerCase();
        if (typeStr.includes('ali') || typeStr.includes('elep') || typeStr === 'elephant' || typeStr.includes('අලියා')) {
          elephantType = 'elephant';
        }

        // Gender
        let gender: Gender = 'male';
        const genderStr = (mapped.gender || '').toLowerCase();
        if (genderStr.includes('fem') || genderStr.includes('gah') || genderStr === 'female' || genderStr.includes('ගැහැණු') || genderStr.includes('ඇතින්න')) {
          gender = 'female';
        }

        // Parse Arrays
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

        // Find existing match
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
          type: elephantType,
          age: mapped.age || (mapped.dateOfBirth ? `${new Date().getFullYear() - parseInt(mapped.dateOfBirth) || ''}` : ''),
          dateOfBirth: String(mapped.dateOfBirth || ''),
          location: mapped.location || (matchedElephant?.location || 'Sri Lanka'),
          organization: mapped.organization || (matchedElephant?.organization || 'Sri Lanka'),
          mahout: mapped.mahout || (matchedElephant?.mahout || 'National Custodians'),
          tusks: mapped.tusks || (matchedElephant?.tusks || (elephantType === 'tusker' ? 'දිගු සවිමත් යුගල දළ (Twin Tusks)' : 'N/A')),
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
    } catch (err: any) {
      console.error('File parsing error:', err);
      alert(`Error reading file: ${err.message || err}`);
    } finally {
      setIsParsing(false);
    }
  };

  /**
   * File Reading with standard ArrayBuffer
   */
  const handleReadUploadedFile = (selectedFile: File) => {
    setFile(selectedFile);
    setIsParsing(true);
    setImportComplete(false);
    setImportLogs([]);

    const reader = new FileReader();
    
    // Tier 1: Read as ArrayBuffer (Modern standard for .xlsx)
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
        console.warn('ArrayBuffer read failed, trying Tier 2 (binary string)...', err);
        
        // Tier 2 Fallback: Read as Binary String (Extremely reliable for legacy browsers and multi-format)
        try {
          const binaryReader = new FileReader();
          binaryReader.onload = (binEvt) => {
            try {
              const binData = binEvt.target?.result;
              if (!binData) {
                throw new Error('Could not read file data as BinaryString');
              }
              const wb = XLSX.read(binData, {
                type: 'binary',
                cellDates: true,
                raw: false,
              });
              processWorkbook(wb);
            } catch (binErr: any) {
              console.warn('Binary string read failed, trying Tier 3 (text string)...', binErr);
              
              // Tier 3 Fallback: Read as Text (Best for plain .csv files)
              try {
                const textReader = new FileReader();
                textReader.onload = (textEvt) => {
                  try {
                    const textData = textEvt.target?.result as string;
                    if (!textData) {
                      throw new Error('Could not read file data as Text');
                    }
                    const wb = XLSX.read(textData, {
                      type: 'string',
                      cellDates: true,
                      raw: false,
                    });
                    processWorkbook(wb);
                  } catch (textErr: any) {
                    console.error('All file reading strategies failed.', textErr);
                    alert(
                      language === 'si'
                        ? `ගොනුව කියවීමට නොහැකි විය. කරුණාකර නිවැරදි Excel (.xlsx) හෝ CSV ගොනුවක් භාවිතා කරන්න. (Error: ${textErr.message || textErr})`
                        : `Could not parse file. Please use a valid Excel (.xlsx) or CSV file. (Error: ${textErr.message || textErr})`
                    );
                    setIsParsing(false);
                  }
                };
                textReader.onerror = () => {
                  alert(language === 'si' ? 'ගොනුව කියවීම අසාර්ථක විය.' : 'Error reading file.');
                  setIsParsing(false);
                };
                textReader.readAsText(selectedFile);
              } catch (textSetupErr: any) {
                alert(`Error: ${textSetupErr.message || textSetupErr}`);
                setIsParsing(false);
              }
            }
          };
          binaryReader.onerror = () => {
            alert(language === 'si' ? 'ගොනුව කියවීම අසාර්ථක විය.' : 'Error reading file.');
            setIsParsing(false);
          };
          binaryReader.readAsBinaryString(selectedFile);
        } catch (binarySetupErr: any) {
          alert(`Error: ${binarySetupErr.message || binarySetupErr}`);
          setIsParsing(false);
        }
      }
    };

    reader.onerror = () => {
      alert(language === 'si' ? 'ගොනුව කියවීම අසාර්ථක විය.' : 'Error reading file.');
      setIsParsing(false);
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
  // 4. SMART MERGE PAYLOAD BUILDER
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
        sources: [
          {
            title: 'Official Custodians / Bulk Import Registry',
            publisher: 'Sri Lankan Elephant Registry',
            verifiedDate: new Date().getFullYear().toString(),
          },
        ],
        verified: autoVerifyAll ? true : row.verified,
        status: row.status,
        isFeatured: row.isFeatured,
        isLive: row.isLive,
        customBadge: row.customBadge,
      };
    }

    // SMART MERGE: Fill in missing / empty fields while preserving existing good data!
    const mergedOtherNames = Array.from(
      new Set([...(existing.otherNames || []), ...(row.otherNames || [])])
    ).filter(Boolean);

    const mergedPeraheras = Array.from(
      new Set([...(existing.peraheraParticipation || []), ...(row.peraheraParticipation || [])])
    ).filter(Boolean);

    // Merge Photos: preserve existing real photos, append new ones without duplicates
    const existingPhotos = (existing.photos || []).filter((p) => p && (p.startsWith('http') || p.startsWith('data:image')));
    const newPhotos = (row.photos || []).filter((p) => p && (p.startsWith('http') || p.startsWith('data:image')));
    const mergedPhotos = Array.from(new Set([...existingPhotos, ...newPhotos]));
    if (mergedPhotos.length === 0) {
      mergedPhotos.push(DEFAULT_SAMPLE_PHOTOS[0]);
    }

    return {
      name: existing.name || row.name,
      sinhalaName: !isMissingOrPlaceholder(existing.sinhalaName) ? existing.sinhalaName : (row.sinhalaName || existing.sinhalaName || ''),
      otherNames: mergedOtherNames,
      gender: existing.gender || row.gender,
      type: existing.type || row.type,
      age: !isMissingOrPlaceholder(existing.age) ? existing.age : (row.age || existing.age || ''),
      dateOfBirth: !isMissingOrPlaceholder(existing.dateOfBirth) ? existing.dateOfBirth : (row.dateOfBirth || existing.dateOfBirth || ''),
      location: !isMissingOrPlaceholder(existing.location) ? existing.location : (row.location || existing.location || 'Sri Lanka'),
      organization: !isMissingOrPlaceholder(existing.organization) ? existing.organization : (row.organization || existing.organization || 'Sri Lanka'),
      mahout: !isMissingOrPlaceholder(existing.mahout) ? existing.mahout : (row.mahout || existing.mahout || 'National Custodians'),
      tusks: !isMissingOrPlaceholder(existing.tusks) ? existing.tusks : (row.tusks || existing.tusks || ''),
      physicalCharacteristics: !isMissingOrPlaceholder(existing.physicalCharacteristics) ? existing.physicalCharacteristics : (row.physicalCharacteristics || existing.physicalCharacteristics || ''),
      description: !isMissingOrPlaceholder(existing.description) ? existing.description : (row.description || existing.description || ''),
      peraheraParticipation: mergedPeraheras,
      photos: mergedPhotos,
      sources: existing.sources && existing.sources.length > 0 ? existing.sources : [
        {
          title: 'Official Custodians / Bulk Import Registry',
          publisher: 'Sri Lankan Elephant Registry',
          verifiedDate: new Date().getFullYear().toString(),
        },
      ],
      verified: autoVerifyAll ? true : (existing.verified ?? row.verified),
      status: existing.status || row.status,
      isFeatured: existing.isFeatured || row.isFeatured,
      isLive: existing.isLive || row.isLive,
      customBadge: !isMissingOrPlaceholder(existing.customBadge) ? existing.customBadge : (row.customBadge || existing.customBadge || ''),
    };
  };

  // -------------------------------------------------------------
  // 5. EXECUTE IMPORT
  // -------------------------------------------------------------
  const handleStartImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      alert(language === 'si' ? 'ඇතුළත් කිරීමට වලංගු වාර්තා නොමැත.' : 'No valid records to import.');
      return;
    }

    setIsImporting(true);
    setImportComplete(false);
    const total = validRows.length;
    let successCount = 0;
    let failCount = 0;
    const logs: string[] = [];

    setImportProgress({ current: 0, total, success: 0, failed: 0 });

    for (let i = 0; i < total; i++) {
      const row = validRows[i];
      setImportProgress({ current: i + 1, total, success: successCount, failed: failCount });

      try {
        const isMatch = row.isExistingMatch && row.matchedElephant;
        const targetId = (importMode !== 'add_only' && isMatch) ? row.matchedId : undefined;

        const payload = buildSmartMergedPayload(row, (importMode !== 'add_only' && isMatch) ? row.matchedElephant : undefined);

        // pass true to skipRefresh to prevent serial downloads of the entire DB
        await onSaveElephant(payload, targetId, true);

        successCount++;
        if (targetId) {
          const filledText = row.missingFieldsToFill && row.missingFieldsToFill.length > 0
            ? ` (අඩු තොරතුරු ${row.missingFieldsToFill.length}ක් සම්පූර්ණ විය)`
            : '';
          logs.push(`✓ [${i + 1}/${total}] ${row.name} (${row.sinhalaName || 'Elephant'}) - පැතිකඩ යාවත්කාලීන විය${filledText}`);
        } else {
          logs.push(`✓ [${i + 1}/${total}] ${row.name} (${row.sinhalaName || 'Elephant'}) - අලුතින් එක් විය (New Added)`);
        }
      } catch (err: any) {
        failCount++;
        logs.push(`✗ [${i + 1}/${total}] ${row.name} - Error: ${err.message || err}`);
      }

      setImportLogs([...logs]);
    }

    // Trigger exactly ONE final single update to fetch fresh database state
    if (successCount > 0) {
      try {
        await onSaveElephant({ name: '__REFRESH__' } as any);
      } catch (e) {
        console.warn('Final state refresh notice:', e);
      }
    }

    setImportProgress({ current: total, total, success: successCount, failed: failCount });
    setIsImporting(false);
    setImportComplete(true);
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const matchCount = parsedRows.filter((r) => r.isExistingMatch).length;

  return (
    <div className="space-y-6 animate-fadeIn text-[#062E22]">
      {/* Top Banner with Template Downloads */}
      <div className="bg-gradient-to-r from-[#062E22] to-emerald-900 text-white rounded-3xl p-6 sm:p-7 shadow-md relative overflow-hidden">
        <div className="relative z-10 space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-zinc-950 shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>EXCEL / CSV SMART IMPORT & AUTO-MERGE</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            {language === 'si'
              ? 'Excel (.xlsx) හරහා අලි තොරතුරු එකවර යාවත්කාලීන කරන්න'
              : 'Bulk Import & Smart Merge via Excel (.xlsx)'}
          </h2>

          <p className="text-xs text-emerald-100/90 leading-relaxed">
            {language === 'si'
              ? 'විහාරස්ථාන හෝ ලේඛනාගාර Excel (.xlsx / .csv) ගොනුවක් Upload කරන්න. කලින් සිටින අලියෙකුගේ නම ගොනුවේ තිබේ නම්, එම අලියාගේ පැතිකඩේ නොමැති (Missing) තොරතුරු ස්වයංක්‍රීයව සම්පූර්ණ කර යාවත්කාලීන කරනු ලැබේ.'
              : 'Upload Excel (.xlsx) or CSV files. If an elephant already exists in the registry, missing profile details (Sinhala names, mahout, tusk details, peraheras, photos) will be smartly merged and updated!'}
          </p>

          {/* Download Sample Templates Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              onClick={handleDownloadExcelTemplate}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition-transform active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Download Excel Template (.xlsx)</span>
            </button>

            <button
              onClick={handleDownloadCSVTemplate}
              className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl text-xs font-bold flex items-center gap-2 backdrop-blur-xs transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download CSV Template (.csv)</span>
            </button>
          </div>
        </div>

        {/* Decorative Background Icon */}
        <FileSpreadsheet className="absolute -right-6 -bottom-6 w-48 h-48 text-white/5 pointer-events-none" />
      </div>

      {/* File Upload / Drag & Drop Area */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="bg-white rounded-3xl p-8 border-2 border-dashed border-emerald-300 hover:border-emerald-600 transition-all cursor-pointer text-center space-y-3 shadow-xs group"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="w-16 h-16 rounded-2xl bg-emerald-50 group-hover:bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto transition-transform group-hover:scale-110 shadow-xs">
          <Upload className="w-8 h-8" />
        </div>

        <div>
          <h3 className="font-extrabold text-sm sm:text-base text-[#062E22]">
            {file ? file.name : (language === 'si' ? 'Excel (.xlsx) හෝ CSV (.csv) ගොනුව මෙතැනට තෝරන්න' : 'Select or Drag & Drop Excel (.xlsx) / CSV file here')}
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {file
              ? `${(file.size / 1024).toFixed(1)} KB • Click to choose another file`
              : (language === 'si' ? '.xlsx, .xls, හෝ .csv ගොනුවක් Upload කිරීමට මෙතැන ක්ලික් කරන්න' : 'Supports .xlsx, .xls, and .csv files')}
          </p>
        </div>

        {isParsing && (
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-800 animate-pulse pt-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Excel ගොනුව කියවා දත්ත සසඳමින් පවතී (Parsing spreadsheet data)...</span>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* PARSED DATA PREVIEW & CONTROLS                                */}
      {/* ------------------------------------------------------------- */}
      {parsedRows.length > 0 && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-zinc-200 shadow-sm space-y-5">
          {/* Summary & Options Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
            <div>
              <h3 className="font-extrabold text-base text-[#062E22] flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-700" />
                <span>
                  {language === 'si'
                    ? `හඳුනාගත් අලි පැතිකඩ (${parsedRows.length})`
                    : `Parsed Elephant Profiles (${parsedRows.length})`}
                </span>
              </h3>
              <p className="text-xs text-zinc-500 mt-1 flex items-center gap-2">
                <span className="font-bold text-emerald-700">{validCount} Valid Records</span>
                <span>•</span>
                <span className="font-bold text-amber-700">{matchCount} Existing Elephant Matches Found</span>
              </p>
            </div>

            {/* Smart Import Options */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {/* Import Mode Selector */}
              <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200">
                <button
                  type="button"
                  onClick={() => setImportMode('smart_merge')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    importMode === 'smart_merge'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                  title="Preserve existing data, only fill in missing fields from Excel"
                >
                  <DatabaseZap className="w-3.5 h-3.5" />
                  <span>Smart Merge (අඩු තොරතුරු පිරවීම)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setImportMode('overwrite_all')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    importMode === 'overwrite_all'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                  title="Overwrite all fields with Excel data"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Overwrite All</span>
                </button>
              </div>

              {/* Auto Verify Toggle */}
              <label className="flex items-center gap-1.5 cursor-pointer bg-zinc-50 hover:bg-zinc-100 px-3 py-2 rounded-xl border border-zinc-200 font-bold transition-colors">
                <input
                  type="checkbox"
                  checked={autoVerifyAll}
                  onChange={(e) => setAutoVerifyAll(e.target.checked)}
                  className="rounded text-emerald-700 focus:ring-emerald-700"
                />
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Auto-Verify all (සත්‍යාපිත ලාංඡනය)</span>
                </span>
              </label>
            </div>
          </div>

          {/* Smart Merge Banner Info */}
          {matchCount > 0 && importMode === 'smart_merge' && (
            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 text-xs text-amber-950 flex items-start gap-2.5 shadow-2xs">
              <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-extrabold">Smart Merge Mode සක්‍රීයයි:</span>
                <p className="text-amber-900/90 text-[11px] leading-relaxed">
                  කලින් පද්ධතියේ සිටින අලි ඇතුන්ගේ පැතිකඩවල් නැවත අලුතින් ලියාපදිංචි නොකර, ඔවුන්ගේ පැතිකඩෙහි <strong>අඩුව තිබූ තොරතුරු (Missing Details)</strong> පමණක් Excel ගොනුවේ ඇති නව තොරතුරුවලින් ස්වයංක්‍රීයව පිරවීමට නියමිතයි.
                </p>
              </div>
            </div>
          )}

          {/* Table Preview */}
          <div className="overflow-x-auto max-h-[420px] rounded-2xl border border-zinc-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F5] border-b border-zinc-200 text-zinc-500 font-extrabold uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Elephant Details</th>
                  <th className="py-2.5 px-3">Type & Gender</th>
                  <th className="py-2.5 px-3">Organization / Location</th>
                  <th className="py-2.5 px-3">Mahout & Tusks</th>
                  <th className="py-2.5 px-3 text-center">Merge / Import Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {parsedRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-zinc-400">{idx + 1}</td>

                    {/* Name + Sinhala Name + Photo */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-zinc-100 border border-zinc-200 flex-shrink-0">
                          <img
                            src={row.photos[0]}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 max-w-[170px]">
                          <div className="font-extrabold text-[#062E22] truncate flex items-center gap-1">
                            <span>{row.name}</span>
                            {row.isExistingMatch && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" title="Existing Profile Match" />
                            )}
                          </div>
                          {row.sinhalaName && (
                            <div className="text-[10px] text-emerald-800 font-sinhala truncate">
                              {row.sinhalaName}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Type & Gender */}
                    <td className="py-2.5 px-3">
                      <div className="space-y-0.5">
                        <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          row.type === 'tusker' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                        }`}>
                          {row.type === 'tusker' ? 'Tusker (ඇතා)' : 'Elephant (අලියා)'}
                        </span>
                        <div className="text-[10px] text-zinc-400 capitalize">{row.gender} • {row.age ? `${row.age} yrs` : 'Age N/A'}</div>
                      </div>
                    </td>

                    {/* Organization & Location */}
                    <td className="py-2.5 px-3">
                      <div className="text-zinc-700 font-semibold truncate max-w-[160px]">
                        {row.organization || 'Sri Lanka'}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">{row.location}</div>
                    </td>

                    {/* Mahout & Tusks */}
                    <td className="py-2.5 px-3">
                      <div className="text-zinc-700 truncate max-w-[140px]">{row.mahout}</div>
                      <div className="text-[10px] text-zinc-400 truncate max-w-[140px]">{row.tusks}</div>
                    </td>

                    {/* Status & Smart Merge Badge */}
                    <td className="py-2.5 px-3 text-center">
                      {row.isExistingMatch ? (
                        <div className="inline-flex flex-col items-center gap-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <Sparkles className="w-2.5 h-2.5 text-amber-700" />
                            <span>
                              {importMode === 'smart_merge' ? 'Smart Merging' : 'Will Overwrite'}
                            </span>
                          </span>
                          {row.missingFieldsToFill && row.missingFieldsToFill.length > 0 && (
                            <span className="text-[9px] text-emerald-800 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/60 truncate max-w-[180px]">
                              +{row.missingFieldsToFill.length} fields to update
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700" />
                          <span>New Elephant</span>
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleRemoveRow(idx)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Remove row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Progress Bar during import */}
          {importProgress && (
            <div className="space-y-2 pt-2 bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#062E22]">
                  {importComplete ? 'Import Completed Successfully!' : 'Updating & Importing records...'}
                </span>
                <span className="text-emerald-800 font-mono">
                  {importProgress.current} / {importProgress.total} ({importProgress.success} Success, {importProgress.failed} Failed)
                </span>
              </div>

              <div className="w-full bg-zinc-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-600 to-amber-400 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                />
              </div>

              {/* Logs */}
              {importLogs.length > 0 && (
                <div className="max-h-32 overflow-y-auto bg-white p-2.5 rounded-xl border border-zinc-200 text-[11px] font-mono space-y-0.5">
                  {importLogs.map((log, lIdx) => (
                    <div key={lIdx} className={log.startsWith('✓') ? 'text-emerald-700' : 'text-red-600'}>
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bottom Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              onClick={() => {
                setParsedRows([]);
                setFile(null);
                setImportProgress(null);
              }}
              className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              {language === 'si' ? 'සියල්ල ඉවත් කරන්න (Clear)' : 'Clear Table'}
            </button>

            <div className="flex items-center gap-2">
              {importComplete ? (
                <button
                  onClick={onFinished}
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{language === 'si' ? 'අවසන් කරන්න (Done / View Directory)' : 'Finish & View Directory'}</span>
                </button>
              ) : (
                <button
                  onClick={handleStartImport}
                  disabled={isImporting || validCount === 0}
                  className="px-7 py-3 bg-[#062E22] hover:bg-emerald-800 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-950/20 flex items-center gap-2 transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>යාවත්කාලීන වෙමින් පවතී ({importProgress?.current || 0}/{validCount})...</span>
                    </>
                  ) : (
                    <>
                      <DatabaseZap className="w-4 h-4" />
                      <span>
                        {language === 'si'
                          ? `අලි ${validCount} දෙනාගේ තොරතුරු යාවත්කාලීන කරන්න (Execute Merge)`
                          : `Import & Merge All ${validCount} Records`}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
