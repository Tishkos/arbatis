-- CreateTable: Only create motorcycle_categories table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'motorcycle_categories'
    ) THEN
        CREATE TABLE "motorcycle_categories" (
            "id" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "nameAr" TEXT,
            "nameKu" TEXT,
            "description" TEXT,
            "parentId" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            "createdById" TEXT,
            "updatedById" TEXT,

            CONSTRAINT "motorcycle_categories_pkey" PRIMARY KEY ("id")
        );

        CREATE INDEX "motorcycle_categories_parentId_idx" ON "motorcycle_categories"("parentId");
        CREATE INDEX "motorcycle_categories_name_idx" ON "motorcycle_categories"("name");

        ALTER TABLE "motorcycle_categories" ADD CONSTRAINT "motorcycle_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "motorcycle_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Add categoryId column to motorcycles table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'motorcycles' AND column_name = 'categoryId'
    ) THEN
        ALTER TABLE "motorcycles" ADD COLUMN "categoryId" TEXT;
        CREATE INDEX IF NOT EXISTS "motorcycles_categoryId_idx" ON "motorcycles"("categoryId");
        
        -- Add foreign key constraint only if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'motorcycles_categoryId_fkey'
        ) THEN
            ALTER TABLE "motorcycles" ADD CONSTRAINT "motorcycles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "motorcycle_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;
