import csv, hashlib, uuid
from decimal import Decimal
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import Sum, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_http_methods
from .models import Student, Fee, Payment, ImportBatch
from .forms import StudentForm, FeeForm, PaymentForm
from .importer import parse

def can_write(user): return user.is_staff

def total(qs): return qs.aggregate(n=Sum('amount'))['n'] or Decimal(0)

@login_required
def dashboard(request):
    students=Student.objects.all()
    q=request.GET.get('q','').strip(); course=request.GET.get('course','');year=request.GET.get('year','2025-26')
    if year: students=students.filter(year=year)
    if q: students=students.filter(Q(name__icontains=q)|Q(admission_number__icontains=q))
    if course: students=students.filter(course=course)
    fees=Fee.objects.filter(student__in=students); payments=Payment.objects.filter(fee__in=fees)
    net=sum((f.amount-f.concession for f in fees),Decimal(0)); paid=total(payments)
    outstanding=sum((max(f.balance,Decimal(0)) for f in fees),Decimal(0));credit=sum((max(-f.balance,Decimal(0)) for f in fees),Decimal(0))
    rows=[]
    for s in students:
        fs=list(s.fees.all()); rows.append({'student':s,'college':sum((f.college for f in fs),Decimal(0)),'our':sum((f.ours for f in fs),Decimal(0)),'balance':sum((f.balance for f in fs),Decimal(0)),'unknown':not fs})
    return render(request,'fees/dashboard.html',{'rows':rows,'courses':Student.objects.values_list('course',flat=True).distinct(),'q':q,'course':course,'year':year,'net':net,'college':total(payments.filter(account='college')),'our':total(payments.filter(account='our')),'outstanding':outstanding,'credit':credit,'count':students.count(),'recent':payments.select_related('fee__student')[:10]})

@login_required
@require_http_methods(['GET','POST'])
def student_new(request):
    if not can_write(request.user): raise PermissionDenied
    form=StudentForm(request.POST or None)
    if request.method=='POST' and form.is_valid():
        s=form.save(); messages.success(request,'Student created. Add semester fees below.');return redirect('student',pk=s.pk)
    return render(request,'fees/form.html',{'form':form,'title':'Add student'})

@login_required
@require_http_methods(['GET','POST'])
def student_detail(request,pk):
    s=get_object_or_404(Student,pk=pk)
    pf=PaymentForm(student=s,initial={'token':uuid.uuid4()});ff=FeeForm()
    if request.method=='POST':
      if not can_write(request.user): raise PermissionDenied
      if request.POST.get('action')=='fee':
        ff=FeeForm(request.POST)
        if ff.is_valid():
          if s.fees.filter(semester=ff.cleaned_data['semester']).exists(): ff.add_error('semester','This semester already exists.')
          else:
            f=ff.save(commit=False);f.student=s;f.save();return redirect('student',pk=pk)
      else:
        pf=PaymentForm(request.POST,student=s)
        if pf.is_valid():
          p=pf.save(commit=False);p.created_by=request.user;p.save();messages.success(request,f'Payment saved to {p.get_account_display()}.');return redirect('student',pk=pk)
    return render(request,'fees/student.html',{'student':s,'fees':s.fees.all(),'payments':Payment.objects.filter(fee__student=s).select_related('fee'),'payment_form':pf,'fee_form':ff})

@login_required
@require_http_methods(['GET','POST'])
def import_workbook(request):
    if not can_write(request.user): raise PermissionDenied
    records=None
    if request.method=='POST':
      if request.POST.get('action')=='confirm':
        draft=request.session.get('import_draft')
        if not draft: messages.error(request,'Upload the workbook again.');return redirect('/import/')
        selected=set(request.POST.getlist('selected'))
        chosen=[r for r in draft['records'] if r['key'] in selected]
        if not chosen: messages.error(request,'Select at least one row.');records=draft['records']
        elif any(ImportBatch.objects.filter(digest=hashlib.sha256((draft['digest']+r['key']).encode()).hexdigest()).exists() for r in chosen): messages.error(request,'One or more selected rows were already imported. Upload again to review the remaining rows.');return redirect('/import/')
        else:
          with transaction.atomic():
            for r in chosen:
              ImportBatch.objects.create(digest=hashlib.sha256((draft['digest']+r['key']).encode()).hexdigest(),created_by=request.user)
              s=Student.objects.create(admission_number='MCC-'+draft['digest'][:8]+'-'+str(draft['records'].index(r)+1),name=r['name'],course=r['course'],specialization=r['specialization'],status=r['status'])
              for item in r['fees']:
                f=Fee.objects.create(student=s,semester=item['semester'],amount=item['amount'])
                for account in ['college','our']:
                  if Decimal(item[account])>0: Payment.objects.create(fee=f,account=account,amount=item[account],historical=True,method='historical',reference=r['source'],created_by=request.user,token=uuid.uuid4())
          del request.session['import_draft'];messages.success(request,f'Imported {len(chosen)} students. Generated MCC identifiers are temporary; verify admission numbers.');return redirect('/')
      elif request.FILES.get('file'):
        upload=request.FILES['file']
        if upload.size>5*1024*1024: messages.error(request,'Maximum workbook size is 5 MB.')
        else:
          try:
            data=upload.read();records=parse(data)
            digest=hashlib.sha256(data).hexdigest()
            records=[r for r in records if not ImportBatch.objects.filter(digest=hashlib.sha256((digest+r['key']).encode()).hexdigest()).exists()]
            request.session['import_draft']={'digest':hashlib.sha256(data).hexdigest(),'records':records}
          except Exception:
            messages.error(request,'Could not read this workbook. Upload the original MCC .xlsx file with the expected sheets.')
    return render(request,'fees/import.html',{'records':records})

@login_required
def export(request):
    response=HttpResponse(content_type='text/csv');response['Content-Disposition']='attachment; filename="fees-ledger.csv"'
    writer=csv.writer(response);writer.writerow(['Admission number','Student','Course','Year','Semester','Fee','Concession','College account','Our account','Balance'])
    def safe(v):
        v=str(v)
        return "'"+v if v.startswith(('=','+','-','@','\t','\r')) else v
    for f in Fee.objects.select_related('student').order_by('student__name','semester'):
        s=f.student;writer.writerow([safe(s.admission_number),safe(s.name),safe(s.course),s.year,f.semester,f.amount,f.concession,f.college,f.ours,f.balance])
    return response

@login_required
def receipt(request,pk):
    p=get_object_or_404(Payment.objects.select_related('fee__student','created_by'),pk=pk)
    return render(request,'fees/receipt.html',{'payment':p})

@login_required
def collections(request):
    from django import forms
    class Filters(forms.Form):
        account=forms.ChoiceField(required=False,choices=[('','Both accounts'),('college','College account'),('our','Our account')])
        start=forms.DateField(required=False,widget=forms.DateInput(attrs={'type':'date'}))
        end=forms.DateField(required=False,widget=forms.DateInput(attrs={'type':'date'}))
    form=Filters(request.GET)
    payments=Payment.objects.select_related('fee__student').all()
    if form.is_valid():
        d=form.cleaned_data
        if d['account']: payments=payments.filter(account=d['account'])
        if d['start']: payments=payments.filter(date__gte=d['start'])
        if d['end']: payments=payments.filter(date__lte=d['end'])
    else: payments=payments.none()
    return render(request,'fees/collections.html',{'form':form,'payments':payments,'college':total(payments.filter(account='college')),'our':total(payments.filter(account='our'))})
