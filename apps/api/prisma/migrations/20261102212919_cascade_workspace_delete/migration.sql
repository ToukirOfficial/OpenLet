-- DropForeignKey
ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_reversesId_fkey";

-- DropForeignKey
ALTER TABLE "Tenancy" DROP CONSTRAINT "Tenancy_unitId_fkey";

-- DropForeignKey
ALTER TABLE "TenancyTenant" DROP CONSTRAINT "TenancyTenant_tenantId_fkey";

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenancyTenant" ADD CONSTRAINT "TenancyTenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "LedgerEntry"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
