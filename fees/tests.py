from datetime import date
from decimal import Decimal
from io import BytesIO
import uuid
import openpyxl
from django.contrib.auth.models import User
from django.test import TestCase
from .models import Student,Fee,Payment,ImportBatch
from .importer import parse,money

class FeeWorkflowTests(TestCase):
    def setUp(self):
        self.staff=User.objects.create_user('accountant',password='test-password-only',is_staff=True)
        self.viewer=User.objects.create_user('viewer',password='test-password-only')
        self.student=Student.objects.create(admission_number='A001',name='Student One',course='BBA')
        self.fee=Fee.objects.create(student=self.student,semester=1,amount=98000)
        self.client.force_login(self.staff)
    def pay(self,account,amount,**kw):
        return Payment.objects.create(fee=self.fee,account=account,amount=amount,created_by=self.staff,token=uuid.uuid4(),**kw)
    def test_two_accounts_reduce_balance_and_preserve_credit(self):
        self.pay('college',30000);self.pay('our',40000)
        self.assertEqual(self.fee.college,30000);self.assertEqual(self.fee.ours,40000);self.assertEqual(self.fee.balance,28000)
        self.pay('college',30000);self.assertEqual(self.fee.balance,-2000)
        response=self.client.get('/');self.assertEqual(response.context['outstanding'],0);self.assertEqual(response.context['credit'],2000)
    def test_payment_form_receipt_and_duplicate_submission(self):
        data={'fee':self.fee.pk,'account':'our','amount':'40000','date':'2026-01-17','method':'cash','token':str(uuid.uuid4())}
        self.assertEqual(self.client.post(f'/students/{self.student.pk}/',data).status_code,302)
        self.client.post(f'/students/{self.student.pk}/',data)
        self.assertEqual(Payment.objects.count(),1)
        self.assertContains(self.client.get(f'/receipts/{Payment.objects.get().pk}/'),'Our account')
    def test_cross_student_fee_and_negative_payment_rejected(self):
        other=Student.objects.create(admission_number='B001',name='Other',course='BCA')
        otherfee=Fee.objects.create(student=other,semester=1,amount=100)
        data={'fee':otherfee.pk,'account':'college','amount':'-1','date':'2026-01-17','method':'cash','token':str(uuid.uuid4())}
        self.client.post(f'/students/{self.student.pk}/',data)
        self.assertEqual(Payment.objects.count(),0)
    def test_viewer_cannot_write_and_anonymous_cannot_read(self):
        self.client.force_login(self.viewer)
        self.assertEqual(self.client.get('/').status_code,200)
        for path in ['/students/new/','/import/',f'/students/{self.student.pk}/']:
            self.assertEqual(self.client.post(path,{}).status_code,403)
        self.client.logout();self.assertEqual(self.client.get('/export/').status_code,302)
    def test_report_date_and_account_filters(self):
        self.pay('college',100,date=date(2026,1,17));self.pay('our',200,historical=True,method='historical');self.pay('our',300,date=date(2026,1,18))
        r=self.client.get('/collections/?start=2026-01-17&end=2026-01-17')
        self.assertEqual(r.context['college'],100);self.assertEqual(r.context['our'],0)
        r=self.client.get('/collections/?account=our');self.assertEqual(r.context['our'],500);self.assertEqual(r.context['college'],0)
    def test_export_escapes_formula_text(self):
        self.student.name='=SUM(1,2)';self.student.save()
        self.assertIn("'=SUM(1,2)",self.client.get('/export/').content.decode())
    def workbook(self):
        w=openpyxl.Workbook();w.remove(w.active)
        for name in ['BCA','B.com','BBA','FASHION DESIGNING','BSW','MSW','MSC PSYCOLOGY','BSC PHYCOLOGY']: w.create_sheet(name)
        s=w['BCA'];s['B4']='Imported Student';s['C4']=110000;s['D4']='30000+30000';s['E4']=40000;s['F4']=10000
        s['B72']='Pending duplicate';s['C72']=99999
        b=BytesIO();w.save(b);return b.getvalue()
    def test_import_main_only_preserves_accounts_and_blocks_repeat(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        data=self.workbook();records=parse(data)
        self.assertEqual(len(records),1);self.assertEqual(records[0]['fees'][0]['college'],'60000')
        self.client.post('/import/',{'file':SimpleUploadedFile('fees.xlsx',data)})
        self.client.post('/import/',{'action':'confirm','selected':['BCA:4']})
        imported=Student.objects.get(name='Imported Student');f=imported.fees.get()
        self.assertEqual(f.balance,10000);self.assertTrue(all(p.date is None and p.historical for p in f.payments.all()))
        self.client.post('/import/',{'file':SimpleUploadedFile('fees.xlsx',data)})
        self.client.post('/import/',{'action':'confirm','selected':['BCA:4']})
        self.assertEqual(Student.objects.filter(name='Imported Student').count(),1)
    def test_money_rejects_formulas_and_keeps_blank_distinct(self):
        self.assertEqual(money('20000+5000'),25000)
        self.assertEqual(money('NILL'),0);self.assertIsNone(money(None))
        with self.assertRaises(ValueError):money('=SUM(A1:A2)')
    def test_csrf_enforced(self):
        from django.test import Client
        c=Client(enforce_csrf_checks=True);c.force_login(self.staff)
        self.assertEqual(c.post('/students/new/',{}).status_code,403)
