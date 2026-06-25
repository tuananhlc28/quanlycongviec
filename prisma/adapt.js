const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔄 Bắt đầu chạy script chuẩn hóa dữ liệu...');

  const services = await prisma.service.findMany();
  const sources = await prisma.supplierSource.findMany();

  console.log(`Tìm thấy ${services.length} dịch vụ và ${sources.length} nguồn cung cấp.`);

  for (const service of services) {
    console.log(`Đang xử lý dịch vụ: ${service.name} (ID: ${service.id})...`);

    // Danh sách các gói chuẩn hóa
    const packageTemplates = [
      { name: '7 ngày', durationDays: 7 },
      { name: '15 ngày', durationDays: 15 },
      { name: '1 tháng', durationDays: 30 },
      { name: '3 tháng', durationDays: 90 },
      { name: '6 tháng', durationDays: 180 },
      { name: '12 tháng', durationDays: 365 }
    ];

    for (const temp of packageTemplates) {
      // Tính toán giá bán chuẩn
      let salePrice = 0;
      let costPrice = 0;

      if (service.defaultDurationDays === 365) {
        // Gói gốc 365 ngày (Canva Pro)
        const dayRateSale = service.defaultSalePrice / 365;
        const dayRateCost = service.defaultCostPrice / 365;
        salePrice = Math.round(dayRateSale * temp.durationDays * 1.2 / 1000) * 1000;
        costPrice = Math.round(dayRateCost * temp.durationDays * 1.1 / 1000) * 1000;
      } else {
        // Gói gốc 30 ngày (ChatGPT, Grok, Claude)
        const dayRateSale = service.defaultSalePrice / service.defaultDurationDays;
        const dayRateCost = service.defaultCostPrice / service.defaultDurationDays;
        salePrice = Math.round(dayRateSale * temp.durationDays / 1000) * 1000;
        costPrice = Math.round(dayRateCost * temp.durationDays / 1000) * 1000;
      }

      // Đảm bảo không bị 0
      if (salePrice <= 0) salePrice = 10000;
      if (costPrice <= 0) costPrice = 5000;

      // Canva Pro 12 tháng giữ nguyên giá gốc của service
      if (service.slug === 'canva-pro' && temp.durationDays === 365) {
        salePrice = service.defaultSalePrice;
        costPrice = service.defaultCostPrice;
      } else if (service.defaultDurationDays === temp.durationDays) {
        salePrice = service.defaultSalePrice;
        costPrice = service.defaultCostPrice;
      }

      // Check if package already exists
      let pkg = await prisma.servicePackage.findFirst({
        where: { serviceId: service.id, durationDays: temp.durationDays }
      });

      if (!pkg) {
        pkg = await prisma.servicePackage.create({
          data: {
            serviceId: service.id,
            name: temp.name,
            durationDays: temp.durationDays,
            salePrice,
            description: `Gói dịch vụ ${temp.name} cho ${service.name}`,
            sortOrder: temp.durationDays,
            isActive: true
          }
        });
        console.log(`  ➕ Đã tạo gói: ${temp.name} (${salePrice}đ)`);
      } else {
        console.log(`  ✔ Gói đã tồn tại: ${temp.name}`);
      }

      // Liên kết nguồn hàng cho gói này
      for (const source of sources) {
        // Check if mapping exists
        const mapping = await prisma.supplierSourceProduct.findUnique({
          where: {
            supplierSourceId_packageId: {
              supplierSourceId: source.id,
              packageId: pkg.id
            }
          }
        });

        if (!mapping) {
          // Tính giá vốn ngẫu nhiên dao động quanh giá vốn chuẩn
          const delta = (Math.random() - 0.5) * 0.1; // +/- 5%
          const sourceCost = Math.round((costPrice * (1 + delta)) / 1000) * 1000;
          const randomStock = Math.floor(Math.random() * 100) + 15;

          await prisma.supplierSourceProduct.create({
            data: {
              supplierSourceId: source.id,
              packageId: pkg.id,
              costPrice: sourceCost,
              stock: randomStock,
              deliveryMethod: Math.random() > 0.5 ? 'AUTO' : 'MANUAL'
            }
          });
          console.log(`    🔗 Liên kết nguồn ${source.name} -> Giá vốn: ${sourceCost}đ, Tồn: ${randomStock}`);
        }
      }
    }
  }

  // Đặt trạng thái ban đầu cho các khách hàng
  const customers = await prisma.customer.findMany();
  for (const customer of customers) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        status: 'ACTIVE',
        creditRating: 'B' // Giá trị tạm
      }
    });
  }

  console.log('✅ Chuẩn hóa hoàn tất thành công!');
}

main()
  .catch(e => {
    console.error('❌ Lỗi chạy script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
