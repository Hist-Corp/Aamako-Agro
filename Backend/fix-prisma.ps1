$schema = Get-Content 'C:\Users\poude\Desktop\Aamako Agro\Aamako-Agro\Backend\prisma\schema.prisma' -Raw
$idx = $schema.LastIndexOf('model SupportMessage')
$before = $schema.Substring(0, $idx)
$after = $schema.Substring($idx)
$subscriber = @"

model Subscriber {
  id        String   @id @default(uuid())
  email     String   @unique
  firstName String?
  lastName  String?
  source    String   @default("homepage")
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("subscribers")
}
"@
$fixed = $before + $subscriber + [Environment]::NewLine + $after
[System.IO.File]::WriteAllText('C:\Users\poude\Desktop\Aamako Agro\Aamako-Agro\Backend\prisma\schema.prisma', $fixed)
Write-Host 'Prisma schema updated'
