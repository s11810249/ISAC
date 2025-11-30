// core/constants.js

/**
 * 網站 Tailwind CSS 配置
 */
export const tailwindConfig = {
    theme: {
        extend: {
            colors: {
                primary: '#002E5D', secondary: '#C6A87C', success: '#219653', danger: '#DC2626', surface: '#ffffff', background: '#F8FAFC',
                indigo: { 600: '#4F46E5', 700: '#4338CA' }
            },
            fontFamily: { sans: ['"Noto Sans TC"', 'sans-serif'] },
            animation: { 'fade-in': 'fadeIn 0.3s ease-out forwards' },
            keyframes: { fadeIn: { '0%': { opacity: '0', transform: 'scale(0.95)' }, '100%': { opacity: '1', transform: 'scale(1)' } } }
        }
    }
};

/**
 * 全域常數與路徑
 */
export const DATA_FILE = 'hedb/config.json';
export const DEPT_DATA_PATH = 'hedb/data_departments.json';
export const DEPT_MASTER_PATH = 'hedb/data_dept_master.json';
export const YEAR_TEMPLATES_BASE_PATH = 'hedb/year_templates';

/**
 * 核心系統欄位定義
 */
export const SYSTEM_FIELDS = [
    { id: 'school_year', label: '學年', required: false, isSystem: true, order: 1, example: '114' },
    { id: 'semester', label: '學期', required: false, isSystem: true, order: 2, example: '1' },
    { id: 'student_id', label: '學號', required: true, isSystem: true, order: 3, example: '12345678' },
    { id: 'student_name', label: '姓名', required: false, isSystem: true, order: 4, example: '王小明' },
    { id: 'student_college', label: '學院', required: false, isSystem: true, order: 5, example: '管理學院', type: 'college' }, 
    { id: 'student_dept', label: '學生所屬學系', required: true, isSystem: true, order: 6, example: '資管系', type: 'department' },
    { id: 'course_id', label: '選課代號', required: false, isSystem: true, order: 7, example: '8099' },
    { id: 'course_name', label: '課程名稱', required: false, isSystem: true, order: 8, example: '校外實習' }, 
    { id: 'internship_attr', label: '實習課程屬性', required: false, isSystem: true, order: 9, example: '必選' },
    { id: 'internship_credit', label: '實習學分數', required: false, isSystem: true, order: 10, example: '3' }, 
    { id: 'course_system', label: '開課學制', required: false, isSystem: true, order: 11, example: '日間部' }, 
    { id: 'course_college', label: '開課學院', required: false, isSystem: true, order: 12, example: '管理學院', type: 'college' }, 
    { id: 'course_dept', label: '開課學系', required: true, isSystem: true, order: 13, example: '國貿系', type: 'department' },
    { id: 'student_grade', label: '學生年級', required: false, isSystem: true, order: 14, example: '四年級' },
    { id: 'student_gender', label: '性別', required: false, isSystem: true, order: 15, example: '男' },
    { id: 'student_nationality', label: '實習生國籍', required: false, isSystem: true, order: 16, example: '中華民國' }
];

/**
 * 核心邏輯 ID
 */
export const MANDATORY_LOGIC_IDS = ['course_dept', 'student_dept', 'student_id'];

/**
 * 系統預設分類
 */
export const SYSTEM_CATEGORY_DEFS = [
    { id: 'sys_course_info', name: '【系統】開課資訊', isLocked: true, order: -2 },
    { id: 'sys_student_info', name: '【系統】學生資訊', isLocked: true, order: -1 }
];
export const ALLOWED_MAPPING_CATEGORY_IDS = SYSTEM_CATEGORY_DEFS.map(c => c.id);

/**
 * 系統預設欄位類型
 */
export const SYSTEM_DEFAULT_TYPES = [
    {key:'text', label:'文字'}, 
    {key:'number', label:'數字'}, 
    {key:'date', label:'日期'}, 
    {key:'single_select', label:'單選'}, 
    {key:'list', label:'條列式'},
    {key:'address', label:'地址'},
    {key:'college', label:'學院'},
    {key:'department', label:'學系'}
];

/**
 * 報表顯示欄位順序
 */
export const OUTPUT_DISPLAY_FIELDS = [
    { id: 'student_id', label: '學號' },
    { id: 'student_name', label: '姓名' },
    { id: 'semester', label: '學期' },
    { id: 'course_college', label: '開課學院' },
    { id: 'course_dept', label: '開課學系' },
    { id: 'course_id', label: '選課代號' },
    { id: 'course_name', label: '課程名稱' },
    { id: 'internship_attr', label: '實習課程屬性' },
    { id: 'internship_credit', label: '實習學分數' },
    { id: 'student_college', label: '學院' },
    { id: 'student_dept', label: '學生所屬學系' }
];

/**
 * 輔助函數 (為確保獨立性，將常用的通用功能放在 utils.js)
 */
export const cleanInput = (value) => value ? String(value).trim() : '';
