import { db } from "./src/index";
import { itemsTable, warehousesTable } from "./src/schema/namri-inventory";
import { eq } from "drizzle-orm";

async function seedItems() {
  console.log("🚀 جاري البحث عن المستودع وإدخال مواد المقاولات...");

  let [warehouse] = await db
    .select()
    .from(warehousesTable)
    .where(eq(warehousesTable.name, "المستودع الرئيسي في المفرق"))
    .limit(1);

  if (!warehouse) {
    const inserted = await db
      .insert(warehousesTable)
      .values({
        name: "المستودع الرئيسي في المفرق",
        location: "المفرق",
        description: "المستودع الرئيسي لمواد المقاولات والسلامة",
      } as any)
      .returning();
    warehouse = inserted[0];
  }

  const warehouseId = warehouse.id;

  const itemsToInsert = [
    { code: "MAT-001", name: "حديد تسليح 12 ملم", category: "مدني", unit: "طن", minQuantity: 5, warehouseId },
    { code: "MAT-002", name: "حديد تسليح 14 ملم", category: "مدني", unit: "طن", minQuantity: 5, warehouseId },
    { code: "MAT-003", name: "حديد تسليح 16 ملم", category: "مدني", unit: "طن", minQuantity: 5, warehouseId },
    { code: "MAT-004", name: "حديد تسليح 8 ملم (كانات)", category: "مدني", unit: "طن", minQuantity: 3, warehouseId },
    { code: "MAT-005", name: "أسمنت بورتلاندي عادي", category: "مدني", unit: "كيس", minQuantity: 50, warehouseId },
    { code: "MAT-006", name: "أسمنت مقاوم للأملاح", category: "مدني", unit: "كيس", minQuantity: 50, warehouseId },
    { code: "MAT-007", name: "طوب مفرغ 15 سم", category: "مدني", unit: "حبة", minQuantity: 500, warehouseId },
    { code: "MAT-008", name: "طوب مفرغ 20 سم", category: "مدني", unit: "حبة", minQuantity: 500, warehouseId },
    { code: "MAT-009", name: "طوب مصمت (أسمنتي)", category: "مدني", unit: "حبة", minQuantity: 200, warehouseId },
    { code: "MAT-010", name: "حصمة مغسولة (سمسمية)", category: "مدني", unit: "متر مكعب", minQuantity: 20, warehouseId },
    { code: "MAT-011", name: "رمل صويلح (ناعم)", category: "مدني", unit: "متر مكعب", minQuantity: 20, warehouseId },
    { code: "MAT-012", name: "رمل خشن (للبناء والقصارة)", category: "مدني", unit: "متر مكعب", minQuantity: 20, warehouseId },
    { code: "MAT-013", name: "شيد مصلح", category: "مدني", unit: "كيس", minQuantity: 10, warehouseId },
    { code: "MAT-014", name: "شبك تسليح أرضيات (Mesh)", category: "مدني", unit: "لوح", minQuantity: 15, warehouseId },
    { code: "MAT-015", name: "خرسانة جاهزة B250", category: "مدني", unit: "متر مكعب", minQuantity: 30, warehouseId },
    { code: "MAT-016", name: "خرسانة جاهزة B300", category: "مدني", unit: "متر مكعب", minQuantity: 30, warehouseId },
    { code: "MAT-017", name: "سلك تربيط مجدول", category: "مدني", unit: "لفة", minQuantity: 10, warehouseId },
    { code: "MAT-018", name: "مسامير خشب 6 سم", category: "مدني", unit: "باكيت", minQuantity: 5, warehouseId },
    { code: "MAT-019", name: "مسامير خشب 10 سم", category: "مدني", unit: "باكيت", minQuantity: 5, warehouseId },
    { code: "MAT-020", name: "خشب طوبار (مربوع 4×4)", category: "مدني", unit: "متر طولي", minQuantity: 100, warehouseId },
    { code: "MAT-021", name: "خوذة سلامة رأس (صقري)", category: "سلامة مهنية", unit: "حبة", minQuantity: 10, warehouseId },
    { code: "MAT-022", name: "حذاء سلامة بنعل فولاذي (بوت)", category: "سلامة مهنية", unit: "زوج", minQuantity: 10, warehouseId },
    { code: "MAT-023", name: "سترة عاكسة للضوء (فطيرة سلامة)", category: "سلامة مهنية", unit: "حبة", minQuantity: 15, warehouseId },
    { code: "MAT-024", name: "نظارات حماية شفافة", category: "سلامة مهنية", unit: "حبة", minQuantity: 15, warehouseId },
    { code: "MAT-025", name: "كمامات غبار واقية", category: "سلامة مهنية", unit: "علبة", minQuantity: 5, warehouseId },
    { code: "MAT-026", name: "قفازات حماية قماشية مغطاة بالمطاط", category: "سلامة مهنية", unit: "زوج", minQuantity: 20, warehouseId },
    { code: "MAT-027", name: "طفاية حريق بودرة 6 كغ", category: "سلامة مهنية", unit: "حبة", minQuantity: 3, warehouseId },
    { code: "MAT-028", name: "حزام أمان للعمل على المرتفعات", category: "سلامة مهنية", unit: "حبة", minQuantity: 5, warehouseId },
    { code: "MAT-029", name: "شريط تحذيري أرضي (أصفر/أسود)", category: "سلامة مهنية", unit: "رول", minQuantity: 5, warehouseId },
    { code: "MAT-030", name: "صندوق إسعافات أولية موقعي", category: "سلامة مهنية", unit: "صندوق", minQuantity: 2, warehouseId },
    { code: "MAT-031", name: "عربة نقل يدوية (ترولي / بانيو)", category: "معدات موقع", unit: "حبة", minQuantity: 4, warehouseId },
    { code: "MAT-032", name: "مجرفة حديدية (شوقة/كريك)", category: "معدات موقع", unit: "حبة", minQuantity: 8, warehouseId },
    { code: "MAT-033", name: "رفش (برويطة) تسوية", category: "معدات موقع", unit: "حبة", minQuantity: 5, warehouseId },
    { code: "MAT-034", name: "خرطوم مياه ليلي 1 إنش", category: "معدات موقع", unit: "متر", minQuantity: 50, warehouseId },
    { code: "MAT-035", name: "سلم ألومنيوم مزدوج (طول 3 متر)", category: "معدات موقع", unit: "حبة", minQuantity: 2, warehouseId },
    { code: "MAT-036", name: "ميزان تسوية ليزر / ميزان ماء", category: "معدات موقع", unit: "حبة", minQuantity: 2, warehouseId },
    { code: "MAT-037", name: "منشار قطع خشب يدوي", category: "معدات موقع", unit: "حبة", minQuantity: 3, warehouseId },
    { code: "MAT-038", name: "مطرقة هدم ثقيلة (شاقور 5 كغ)", category: "معدات موقع", unit: "حبة", minQuantity: 2, warehouseId },
    { code: "MAT-039", name: "شريط قياس معدني (تيكو 50 متر)", category: "معدات موقع", unit: "حبة", minQuantity: 3, warehouseId },
    { code: "MAT-040", name: "حبل ربط نايلون قوي", category: "معدات موقع", unit: "لفة", minQuantity: 5, warehouseId },
    { code: "MAT-041", name: "كابل كهرباء رئيسي 3×6 ملم", category: "كهرباء", unit: "متر", minQuantity: 50, warehouseId },
    { code: "MAT-042", name: "أسلاك كهرباء 2.5 ملم (مفرد)", category: "كهرباء", unit: "لفة", minQuantity: 5, warehouseId },
    { code: "MAT-043", name: "مواسير بلاستيك صلبة (PVC) 16 ملم", category: "كهرباء", unit: "طول", minQuantity: 30, warehouseId },
    { code: "MAT-044", name: "علب توزيع مفاتيح (شالو جداري)", category: "كهرباء", unit: "حبة", minQuantity: 50, warehouseId },
    { code: "MAT-045", name: "مفتاح كهرباء مفرد", category: "كهرباء", unit: "حبة", minQuantity: 20, warehouseId },
    { code: "MAT-046", name: "إبريز كهربائي (مقبس) مع تأريض", category: "كهرباء", unit: "حبة", minQuantity: 30, warehouseId },
    { code: "MAT-047", name: "قاطع كهربائي رئيسي 63 أمبير", category: "كهرباء", unit: "حبة", minQuantity: 2, warehouseId },
    { code: "MAT-048", name: "قاطع كهربائي فرعي 16 أمبير", category: "كهرباء", unit: "حبة", minQuantity: 10, warehouseId },
    { code: "MAT-049", name: "لوحة توزيع قواطع 12 خط", category: "كهرباء", unit: "حبة", minQuantity: 3, warehouseId },
    { code: "MAT-050", name: "سبوت لايت LED 7 واط", category: "كهرباء", unit: "حبة", minQuantity: 40, warehouseId },
    { code: "MAT-051", name: "وحدة إضاءة طوارئ للموقع", category: "كهرباء", unit: "حبة", minQuantity: 4, warehouseId },
    { code: "MAT-052", name: "شريط لاصق عازل للكهرباء (تلو)", category: "كهرباء", unit: "لفة", minQuantity: 15, warehouseId },
    { code: "MAT-053", name: "لمبة إنارة موقع مؤقتة 100 واط", category: "كهرباء", unit: "حبة", minQuantity: 10, warehouseId },
    { code: "MAT-054", name: "طبلية توزيع كهرباء مؤقتة للموقع", category: "كهرباء", unit: "حبة", minQuantity: 2, warehouseId },
    { code: "MAT-055", name: "كابل تمديد إضافي (Extension) 25 متر", category: "كهرباء", unit: "حبة", minQuantity: 3, warehouseId },
    { code: "MAT-056", name: "مواسير تصريف PVC 4 إنش", category: "سباكة", unit: "طول", minQuantity: 20, warehouseId },
    { code: "MAT-057", name: "مواسير تصريف PVC 2 إنش", category: "سباكة", unit: "طول", minQuantity: 20, warehouseId },
    { code: "MAT-058", name: "مواسير تغذية حرارية PPR 3/4 إنش", category: "سباكة", unit: "طول", minQuantity: 25, warehouseId },
    { code: "MAT-059", name: "كوع PVC 4 إنش 90 درجة", category: "سباكة", unit: "حبة", minQuantity: 15, warehouseId },
    { code: "MAT-060", name: "قسام Y PVC 4 إنش", category: "سباكة", unit: "حبة", minQuantity: 10, warehouseId },
    { code: "MAT-061", name: "محبس مياه نحاس 1 إنش", category: "سباكة", unit: "حبة", minQuantity: 5, warehouseId },
    { code: "MAT-062", name: "خزان مياه بولي إيثيلين 2000 لتر", category: "سباكة", unit: "حبة", minQuantity: 2, warehouseId },
    { code: "MAT-063", name: "لاصق مواسير PVC (غراء أصفر)", category: "سباكة", unit: "علبة", minQuantity: 5, warehouseId },
    { code: "MAT-064", name: "شريط تفلون مانع للتسريب", category: "سباكة", unit: "حبة", minQuantity: 20, warehouseId },
    { code: "MAT-065", name: "خلاط مياه مغسلة كروم", category: "سباكة", unit: "حبة", minQuantity: 5, warehouseId },
    { code: "MAT-066", name: "خلاط مجلى مطبخ", category: "سباكة", unit: "حبة", minQuantity: 5, warehouseId },
    { code: "MAT-067", name: "مجرى مياه أرضي (جريل) صلب", category: "سباكة", unit: "حبة", minQuantity: 10, warehouseId },
    { code: "MAT-068", name: "سيفون حمام مخفي", category: "سباكة", unit: "حبة", minQuantity: 5, warehouseId },
    { code: "MAT-069", name: "منهل بلاستيكي أرضي للتفتيش", category: "سباكة", unit: "حبة", minQuantity: 4, warehouseId },
    { code: "MAT-070", name: "قلب محبس مياه احتياطي", category: "سباكة", unit: "حبة", minQuantity: 10, warehouseId },
    { code: "MAT-071", name: "دهان أملشن ناعم داخلي (أبيض أساسي)", category: "تشطيبات", unit: "جالون", minQuantity: 10, warehouseId },
    { code: "MAT-072", name: "دهان أساس (بريمر) زيتي", category: "تشطيبات", unit: "جالون", minQuantity: 8, warehouseId },
    { code: "MAT-073", name: "دهان واجهات خارجية (جرافيت أو تكسيتشر)", category: "تشطيبات", unit: "سطل", minQuantity: 10, warehouseId },
    { code: "MAT-074", name: "معجونة جدران داخلية جاهزة", category: "تشطيبات", unit: "سطل", minQuantity: 15, warehouseId },
    { code: "MAT-075", name: "ورق حفاف (سنفرة) ناعم", category: "تشطيبات", unit: "فرخ", minQuantity: 50, warehouseId },
    { code: "MAT-076", name: "شريط لاصق ورق (حماية الحواف للدهان)", category: "تشطيبات", unit: "لفة", minQuantity: 15, warehouseId },
    { code: "MAT-077", name: "بلاط سيراميك أرضيات 60×60 سم", category: "تشطيبات", unit: "متر مربع", minQuantity: 100, warehouseId },
    { code: "MAT-078", name: "روبة سيراميك ملونة جاهزة", category: "تشطيبات", unit: "كيس", minQuantity: 10, warehouseId },
    { code: "MAT-079", name: "لاصق سيراميك وبلاط (غراء)", category: "تشطيبات", unit: "كيس", minQuantity: 30, warehouseId },
    { code: "MAT-080", name: "ألواح جبسم بورد عادية", category: "تشطيبات", unit: "لوح", minQuantity: 25, warehouseId },
    { code: "MAT-081", name: "معجونة فواصل جبسم بورد", category: "تشطيبات", unit: "كيس", minQuantity: 10, warehouseId },
    { code: "MAT-082", name: "رول دهان (رولا) مع المقبض", category: "تشطيبات", unit: "حبة", minQuantity: 8, warehouseId },
    { code: "MAT-083", name: "رول عزل مائي زفتة (مبرين) 4 ملم", category: "عزل", unit: "لفة", minQuantity: 20, warehouseId },
    { code: "MAT-084", name: "دهان عزل أساس زفتي (سيلر)", category: "عزل", unit: "برميل", minQuantity: 5, warehouseId },
    { code: "MAT-085", name: "عزل فوم بولي يوريثان بخاخ", category: "عزل", unit: "عبوة", minQuantity: 10, warehouseId },
    { code: "MAT-086", name: "سيليكون شفاف مقاوم للرطوبة والعفن", category: "مواد كيميائية", unit: "أنبوب", minQuantity: 15, warehouseId },
    { code: "MAT-087", name: "مادة إيبوكسي لمعالجة الشقوق", category: "مواد كيميائية", unit: "عبوة", minQuantity: 5, warehouseId },
    { code: "MAT-088", name: "مسامير صلب لتثبيت البلاط أو الخشب", category: "مستلزمات", unit: "باكيت", minQuantity: 10, warehouseId },
    { code: "MAT-089", name: "فوم بولي يوريثان رغوي لملء الفراغات", category: "مواد كيميائية", unit: "عبوة", minQuantity: 12, warehouseId },
    { code: "MAT-090", name: "أشرطة عزل مانعة لتسرب الصوت والحرارة", category: "عزل", unit: "رول", minQuantity: 10, warehouseId }
  ];

  for (const item of itemsToInsert) {
    await db.insert(itemsTable).values(item).onConflictDoNothing();
  }

  console.log("✅ تمت إضافة الـ 90 مادة وربطها بالمستودع بنجاح!");
}

seedItems().catch((err) => {
  console.error("❌ حدث خطأ أثناء إدخال المواد:", err);
});