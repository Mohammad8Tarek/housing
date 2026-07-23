@echo off
color 0A
echo =======================================================
echo     Sunrise Staff Housing - Database Quick Fix
echo =======================================================
echo.
echo This script will automatically add the missing columns 
echo (department, job_title, etc.) to the database on this device.
echo.
echo Make sure PostgreSQL is running.
echo.
pause

cd lib\db
set DATABASE_URL=postgresql://postgres:admin123@localhost:5432/staff-housing
echo Running migrations...
call npm run migrate

echo.
echo =======================================================
echo Done! The database has been updated successfully.
echo You can now start your server normally.
echo =======================================================
pause
