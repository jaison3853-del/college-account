from decimal import Decimal
from django.db import models
from django.conf import settings
from django.db.models import Sum
class Student(models.Model):
    admission_number = models.CharField(max_length=60,unique=True)
    name = models.CharField(max_length=180)
    course = models.CharField(max_length=100)
    specialization = models.CharField(max_length=140,blank=True)
    year = models.CharField(max_length=9,default='2025-26')
    status = models.CharField(max_length=20,choices=[('active','Active'),('discontinued','Discontinued'),('no-addon','Without add-on')],default='active')
    phone = models.CharField(max_length=20,blank=True)
    class Meta: ordering = ['course','name']
    def __str__(self): return f'{self.name} ({self.admission_number})'
class Fee(models.Model):
    student = models.ForeignKey(Student,on_delete=models.PROTECT,related_name='fees')
    semester = models.PositiveSmallIntegerField()
    amount = models.DecimalField(max_digits=12,decimal_places=2)
    concession = models.DecimalField(max_digits=12,decimal_places=2,default=0)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['student','semester'],name='unique_student_semester'),models.CheckConstraint(condition=models.Q(amount__gte=0,concession__gte=0,concession__lte=models.F('amount')),name='valid_fee')]
    @property
    def college(self): return self.payments.filter(account='college').aggregate(n=Sum('amount'))['n'] or Decimal(0)
    @property
    def ours(self): return self.payments.filter(account='our').aggregate(n=Sum('amount'))['n'] or Decimal(0)
    @property
    def balance(self): return self.amount-self.concession-self.college-self.ours
class Payment(models.Model):
    fee = models.ForeignKey(Fee,on_delete=models.PROTECT,related_name='payments')
    account = models.CharField(max_length=10,choices=[('college','College account'),('our','Our account')])
    amount = models.DecimalField(max_digits=12,decimal_places=2)
    date = models.DateField(null=True,blank=True)
    method = models.CharField(max_length=15,choices=[('cash','Cash'),('bank','Bank'),('upi','UPI'),('historical','Historical collection')],default='cash')
    reference = models.CharField(max_length=140,blank=True)
    historical = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    token = models.UUIDField(unique=True)
    class Meta:
        ordering = ['-created_at']
        constraints = [models.CheckConstraint(condition=models.Q(amount__gt=0),name='positive_payment'),models.CheckConstraint(condition=models.Q(account__in=['college','our']),name='known_account')]
class ImportBatch(models.Model):
    digest = models.CharField(max_length=64,unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT)
