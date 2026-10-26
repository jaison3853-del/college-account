from django.contrib import admin
from .models import Student,Fee,Payment,ImportBatch
admin.site.register(Student)
admin.site.register(Fee)
@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display=['id','fee','account','amount','date','historical','created_by']
    def has_add_permission(self,request): return False
    def has_change_permission(self,request,obj=None): return False
    def has_delete_permission(self,request,obj=None): return False
@admin.register(ImportBatch)
class ImportAdmin(admin.ModelAdmin):
    def has_add_permission(self,request): return False
    def has_change_permission(self,request,obj=None): return False
    def has_delete_permission(self,request,obj=None): return False
